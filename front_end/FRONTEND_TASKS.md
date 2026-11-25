# Frontend tasks

Work that is left on the frontend after the first build from the Figma design. Each task is small (a few hours to a day) and can be checked by running the app.

- **Figma file:** https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS
- **Design spec and tokens:** `data/figma/figma_spec` and `data/figma/figma_spec_json`
- **How data works:** see "Real data and fake data" in `front_end/README.md`.

Frame links used below:

| Screen                        | Figma frame                                                             |
| ----------------------------- | ----------------------------------------------------------------------- |
| Welcome                       | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-2   |
| Sign in                       | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-7   |
| Create account                | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-12  |
| Home                          | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-17  |
| Book appointment              | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-22  |
| Appointment confirmed         | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-27  |
| Map (Library route)           | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-32  |
| Map (Student union route)     | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-498 |
| Clubs (Organizations)         | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-37  |
| Organization: Computing Soc.  | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-42  |
| Organization: Outdoor Coll.   | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-444 |
| Organization: Creative Circle | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-471 |
| My schedule                   | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-47  |
| Saved places                  | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-52  |
| Settings                      | https://www.figma.com/design/EUWH1kixLUKN2lYmfLVm3I/CATS?node-id=67-57  |

**Useful testing switches**

- Every fake service fails when `SIMULATE_FAKE_BACKEND_ERRORS = true` in `src/shared/fakeBackend.ts`. Set it back to `false` before committing.
- Saved places uses the real backend: stop it (`make backend-down` or stop Docker) to see its error state.
- Fake data lives in memory, so reloading the app signs you out and forgets bookings.

---

## A. Connect features to the real backend

Each of these needs the backend endpoint to exist first. The rule for all of them: **only the service file and `types.ts` change.** Screens keep calling the same function. When the types match the Pydantic model, remove the "FAKE DATA" comment at the top of the service file, and remove the `simulateRequest` import. When no service uses `src/shared/fakeBackend.ts` any more, delete it.

Note: our backend's Pydantic models usually use `snake_case` field names (`start_time`), while the TypeScript types use `camelCase` (`startTime`). Either set up the backend to send camelCase (Pydantic `alias_generator`), or rename the fields in `types.ts` and the screens. Decide once as a team and use it everywhere.

### A1. Schedule

- **Goal:** the Schedule tab shows the student's real week instead of the sample week.
- **Files:** `src/features/schedule/scheduleService.ts`, `src/features/schedule/types.ts`. Backend: `back_end/cats/api/routers/schedule/` (no endpoints yet).
- **Expected response** (e.g. `GET /schedule/week?start=2026-11-16`), matching `ScheduleWeek` in `types.ts`:
  ```json
  {
    "weekStartDate": "2026-11-16",
    "defaultSelectedDate": "2026-11-18",
    "events": [
      {
        "id": "cps340-2026-11-18",
        "type": "class",
        "title": "CPS 340",
        "date": "2026-11-18",
        "startTime": "08:30",
        "endTime": "09:45",
        "location": "Science building",
        "detail": "Prof. Lee"
      }
    ]
  }
  ```
  `type` is one of `class`, `advising`, `study`. The `suggestion` type (the "Book time for your next step" card) can come from the backend or be added in the service; decide with the backend team. `data/schedule_info.json` stores repeating classes differently (`days_of_week`, `length` in minutes), so the backend will need to turn those into one event per day.
- **How to test:** start the backend, open the Schedule tab, tap each day and compare with the database. Stop the backend and check you get "Your schedule didn’t load" with a working "Try again".
- **Figma:** My schedule (67-47)

### A2. Booking an appointment

- **Goal:** Book appointment shows a real open time and Confirm really books it.
- **Files:** `src/features/booking/bookingService.ts`, `src/features/booking/types.ts`, `src/shared/api.ts` (add a `postToApi(path, body)` helper next to `getFromApi`, because confirming needs a POST).
- **Expected responses:**
  - `GET /appointments/offer` → one `AppointmentOffer` (see `types.ts`), or `null` when no times are open.
  - `POST /appointments` with `{ "offerId": "..." }` → the `ConfirmedAppointment`.
  - `GET /appointments/confirmed` → the student's `ConfirmedAppointment`, or `null`.
  - `clearDemoAppointment()` is only for the demo. Delete it and its call in `SettingsScreen.tsx` once bookings are real.
- **How to test:** book from Home → "Meet a professor" and check the appointment appears on Schedule on the right day. Press Back on the confirmation screen and check you can't book twice. Make the POST fail (stop the backend) and check the red message appears, and that nothing shows as booked.
- **Figma:** Book appointment (67-22), Appointment confirmed (67-27)

### A3. Organizations

- **Goal:** Clubs lists real student organizations.
- **Files:** `src/features/clubs/clubService.ts`, `src/features/clubs/types.ts`, `src/features/clubs/ClubsScreen.tsx` (switch the `.map()` to a `FlatList`, because the real list is long).
- **Expected responses:** `GET /organizations` → `Organization[]` and `GET /organizations/{id}` → one `Organization` (see `types.ts`).
- **Needs a decision:** `data/rso_info.json` has real organizations, but no `category`, `initials`, `tagline` or meetups. Decide what to show when those are missing (for example, initials from the name, and a neutral card color with no category).
- **How to test:** open Clubs, scroll the whole list, open several organizations, and open `/organizations/does-not-exist` in the browser to check "Organization not found".
- **Figma:** Clubs (67-37), Organization details (67-42, 67-444, 67-471)

### A4. Saved places

- **Goal:** saved places come from the student's account instead of a fixed list. The buildings already come from the real `GET /locations`.
- **Files:** `src/features/locations/locationService.ts` (replace `SAMPLE_SAVED_PLACES`), `src/features/locations/types.ts`.
- **Expected response:** e.g. `GET /saved-places` → `[{ "destinationId": "library", "name": "Library", "description": "Study spaces · Quiet corners", "locationId": 12 }]`. The service can then match `locationId` to `GET /locations`.
- **Needs a decision:** saving and unsaving places isn't designed yet (no button for it in Figma).
- **How to test:** open Saved places with the backend running and check both rows. Run with an empty database (skip `import_osm_locations.py`) and check "No saved places yet".
- **Figma:** Saved places (67-52)

### A5. Map and routes

- **Goal:** the Map tab's buildings and routes come from the backend.
- **Files:** `src/features/map/mapService.ts`, `src/features/map/types.ts`. Backend: `back_end/cats/api/routers/maps/` (no endpoints yet).
- **Expected responses:** `GET /map` → `CampusMap`, `GET /map/routes/{destinationId}` → `MapRoute` (see `types.ts`; positions are percentages of the map).
- **Needs a decision:** the design is a drawn, illustrative map ("NOT LIVE GPS"). If the team wants a real map with GPS instead, that is a new feature: it needs `react-native-maps`, a `MapScreen.web.tsx` for the browser, and a location-permission design.
- **How to test:** open the Map tab, then Saved places → Student union, and check the route changes without stacking two Map screens (press Back once).
- **Figma:** Map (67-32, 67-498)

### A6. Accounts (sign in, create account, profile)

- **Goal:** real sign in and account creation.
- **Files:** `src/features/auth/authService.ts`, `src/features/auth/types.ts`, `src/features/welcome/WelcomeScreen.tsx` (it checks for an existing session when the app opens).
- **Expected responses:** `POST /auth/sign-in` and `POST /auth/accounts` → `StudentProfile`; `GET /auth/me` → `StudentProfile` or 401; `POST /auth/sign-out`.
- **Needs a decision:** how sessions are stored on the phone (e.g. `expo-secure-store`, which is in Expo Go), and what guests ("Explore campus first") are allowed to do. Remove the prefilled demo email and password (`catsdemo1`) in `SignInScreen.tsx` and `CreateAccountScreen.tsx` before a real release.
- **How to test:** sign in, close and reopen the app (you should stay signed in), sign out (you should land on Welcome and Back should not return to the app), try a wrong password (red message, email kept).
- **Figma:** Welcome (67-2), Sign in (67-7), Create account (67-12), Settings (67-57)

### A7. Home summary

- **Goal:** the date and message on Home's maroon card come from the backend (and use the real date, not November 17, 2026).
- **Files:** `src/features/home/homeService.ts`, `src/features/home/types.ts`.
- **Expected response:** `GET /home` → `{ "today": "2026-11-17", "heroTitle": "A good day to get connected." }`. (If only the date is needed, the service could also use the phone's date and a fixed message, with no endpoint.)
- **How to test:** open Home and check the date. Turn on `SIMULATE_FAKE_BACKEND_ERRORS` (or stop the backend once connected) and check the red "Today’s plan didn’t load" note while the shortcuts still work.
- **Figma:** Home (67-17)

---

## B. Compare with Figma on real phones

Nothing has been checked on a real iPhone or Android phone yet: the first build was only checked in the browser build. For each task: open the screen on an iPhone (TestFlight Expo Go) **and** an Android phone, put it next to the Figma frame, and fix differences in spacing, sizes, colors and wrapping. Fix values in `theme.ts` (or add tokens there), never in the screen.

| Task | Screens                                  | Figma frames                 | Also check                                                                |
| ---- | ---------------------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| B1   | Welcome, Sign in, Create account         | 67-2, 67-7, 67-12            | Status bar text is readable on Welcome; keyboard doesn't cover the fields |
| B2   | Home                                     | 67-17                        | Heart button position; tab bar height above the home indicator            |
| B3   | Map (both routes)                        | 67-32, 67-498                | Route line corners meet cleanly; building labels fit                      |
| B4   | My schedule                              | 67-47                        | Week strip fits on a small phone (iPhone SE); tap each day                |
| B5   | Book appointment, Appointment confirmed  | 67-22, 67-27                 | Android Back on the confirmation doesn't reopen the booking form          |
| B6   | Clubs and the three organization details | 67-37, 67-42, 67-444, 67-471 | iOS swipe-back from a detail returns to Clubs                             |
| B7   | Saved places, Settings                   | 67-52, 67-57                 | No tab is highlighted on Saved places (see C4)                            |

Known differences from Figma on purpose:

- Saved places rows add the real building name from the backend: "CMU Park Library · Study spaces · Quiet corners" instead of "Study spaces · Quiet corners".
- Text fields have a thin border (spec: needed so the field edge is visible).
- The app uses the system font, not Inter (see C1).

---

## C. Assets, fonts and decisions

### C1. Use the Inter font

- **Goal:** text uses Inter on phones, as in the design.
- **Files:** `package.json` (`pnpm exec expo install @expo-google-fonts/inter`), `src/app/_layout.tsx` (load it with `useFonts` and keep the splash screen up until it loads), `src/shared/constants/theme.ts` (`Fonts.sans` and each `TextStyles` entry need the weight-specific family, e.g. `Inter_700Bold`, because Android ignores `fontWeight` for custom fonts).
- **How to test:** compare a title and a caption with Figma on iPhone and Android; check bold text is really bold on Android.
- **Figma:** any frame, e.g. Home (67-17)

### C2. Replace icons and app images with final assets

- **Goal:** final CATS icons and branding.
- **Files:** `src/shared/components/Icon.tsx` (the icon list), `app.json` (app icon, Android adaptive icon background `#E6F4FE` and splash background `#208AEF` are still Expo's defaults), `assets/images/`. The old `assets/images/tabIcons/` PNGs are no longer used and can be deleted.
- **Today:** icons are Apple SF Symbols on iOS and Google Material Symbols on Android/web (both from `expo-symbols`, already installed), chosen to match the Figma outline icons. Decide whether that is final or whether the designer will provide custom icons.
- **How to test:** check the home-screen icon, the splash screen, and every tab icon in light and dark mode.
- **Figma:** tab bar in Home (67-17)

### C3. Approve the dark mode colors

- **Goal:** design sign-off on dark mode. The spec says all dark colors are "proposed".
- **Files:** `src/shared/constants/theme.ts` (`darkColors`).
- **How to test:** switch the phone to dark mode, go through every screen, and show the designer. Check contrast of `textSecondary` and the small 10-point eyebrow text.
- **Figma:** all frames (they only show light mode)

### C4. Decide back-button and tab behavior

- **Goal:** the team agrees on navigation, then we adjust it.
- **Today:** Back on Saved places, Book appointment and organization details returns to wherever you came from (the spec's recommendation), not always to Home like the Figma prototype. On Saved places no tab is highlighted, because it isn't a tab.
- **Files:** `src/shared/navigation.ts`, `src/shared/components/AppTabs.tsx`.
- **How to test:** open Saved places from Home, Map and Settings, and press Back each time.
- **Figma:** Saved places (67-52)

### C5. Review the wording of loading, empty and error states

- **Goal:** product/design approval for messages that aren't in Figma (the spec only described them), e.g. "Nothing scheduled for this day", "Map unavailable", "Organization not found", "Welcome, student" (Settings when not signed in).
- **Files:** the `*Screen.tsx` files; search for `StatePanel` and `InfoNote`.
- **How to test:** turn on `SIMULATE_FAKE_BACKEND_ERRORS` and visit every screen; pick Saturday on the Schedule to see an empty day.
- **Figma:** n/a (not designed yet)

### C6. Remove the unused calendar package

- **Goal:** the old Calendar screen was replaced by the custom week strip, so `react-native-calendars` is no longer used.
- **Files:** `package.json`, `pnpm-lock.yaml` (`pnpm remove react-native-calendars` from `front_end/`).
- **How to test:** `pnpm validate`, `pnpm web`, and open the Schedule tab.

---

## D. Accessibility passes

For each: turn on VoiceOver (iPhone) and TalkBack (Android), set the largest text size, and go through the screen. Every button must say what it does, every tap target must be at least 48×48 (`Size.touchTargetMin`), and nothing may be cut off at large text.

| Task | Screens                                   | Figma frames        | Focus on                                                                              |
| ---- | ----------------------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| D1   | Sign in, Create account                   | 67-7, 67-12         | Field labels and error messages are read out; errors are not shown by color only      |
| D2   | Home, Settings                            | 67-17, 67-57        | Heart button says "Saved places"; tab bar labels at large text                        |
| D3   | My schedule                               | 67-47               | Each day reads as "Wednesday, November 18, selected"; week strip at large text        |
| D4   | Map                                       | 67-32, 67-498       | The map's description is read out; 10-point building labels are readable              |
| D5   | Book appointment, Appointment confirmed   | 67-22, 67-27        | Loading spinner and success are announced                                             |
| D6   | Clubs, organization details, Saved places | 67-37, 67-42, 67-52 | Row labels include the description; reduce-motion setting is respected by transitions |

## E. Long text, no network and dark mode checks

For each: (1) temporarily make the data much longer in the service file (a 60-character organization name, a three-line description) and check nothing overlaps or is cut off; (2) turn on airplane mode, or `SIMULATE_FAKE_BACKEND_ERRORS`, and check the error state and "Try again"; (3) switch to dark mode and check every color is readable.

| Task | Screens                                  | Figma frames        |
| ---- | ---------------------------------------- | ------------------- |
| E1   | Home, Settings                           | 67-17, 67-57        |
| E2   | My schedule, Book appointment, Confirmed | 67-47, 67-22, 67-27 |
| E3   | Clubs, organization details              | 67-37, 67-42        |
| E4   | Map, Saved places                        | 67-32, 67-52        |
| E5   | Welcome, Sign in, Create account         | 67-2, 67-7, 67-12   |
