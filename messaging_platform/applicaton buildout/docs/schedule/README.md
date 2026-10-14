# Class schedules

Implemented locally in `applicaton buildout`. The Schedule tab now has a weekly calendar on larger screens and a daily calendar on phones, course details, an asynchronous-course list, and CSV import with review. Students must sign in to save or read their private schedules. The calendar starts blank; there is no sample schedule feature.

## Terms and dates

Each student's schedule belongs to Fall, Spring, or Summer plus a year. Enter the university's actual start and end dates when creating the term; the application does not infer official term boundaries. Later imports into the same term use those saved dates. Current and future terms are selectable. Ended terms are omitted from the API and the calendar, with no history selector. Records remain in PostgreSQL. A term remains available through its end date, using America/Detroit, and is hidden the following day. Open calendars check expiration every 30 seconds and on foregrounding.

Meeting dates must fit inside the term. A class only appears on its imported weekdays between its own inclusive start/end dates. All times are campus wall-clock times, including when viewing from another time zone. University holidays/cancellations require future exception support; they are not inferred from the CSV. Overnight meetings are currently rejected with a correction message.

## Import

Choose **New term** or **Import CSV**, choose a `.csv` file (maximum 500 KB / 500 rows), then **Review import**. Select classes and save. Existing classes are retained. An identical section is skipped. A changed section is unchecked by default and shows both its incoming and currently saved details; selecting it explicitly replaces that section's details and meetings. A stale review cannot overwrite a more recent change: review again if another import or removal changed the term.

Required case-insensitive headers:

```
Section,Course,Title,Credits,Days,Time,Dates,Location,Delivery,Instructor
```

Use M, Tu, W, Th, F, Sa, Su for weekdays; `11:00 AM - 11:50 AM` for times; `8/31/26 - 12/18/26` for dates. Four-digit years and ISO date ranges separated by ` - ` are also accepted. Quote fields containing commas. Standard UTF-8 CSV, including BOM and quoted multiline cells, is supported.

For lecture/lab combinations, use repeated Section rows, aligned multiline cells, or the exact registration-export continuation format: blank Section/Course/Title/Credits inherits the immediately preceding course; blank Dates/Delivery/Instructor inherit its values. The continuation must supply its own Days, Time, and Location. Orphan or malformed continuations are flagged and do not silently omit a lab. Exact repeated meeting rows are deduplicated. Empty Days/Time are accepted only for an explicitly asynchronous delivery mode. A malformed row excludes its entire section, avoiding an incomplete lecture-only import when the lab fails. Valid unrelated sections may still be selected.

The supplied `schedule.csv` is covered byte-for-byte by a regression fixture. It imports six courses / 19 credits. BIO 213 includes M/W/F 11:00–11:50 in Biosciences Building 1010 and Wednesday 12:00–14:50 in room 2016, inheriting August 31–December 18, 2026. The online course remains asynchronous.

## Individual events and class directions

Use **New term** to create an empty term without a CSV. **Add event** creates a one-time event with a title, date, start/end time (24-hour campus time), optional location and notes. Location may be left blank, selected from the campus building database, or placed as a draggable map pin. Building IDs are validated against geographic data; labels are canonicalized server-side. Pins are bounded to campus. Remove location clears either choice. No device location is requested by the event editor. Select it on the calendar or under **Your events** to edit or delete it; deletion requires confirmation. Events belong to the selected term, must be within its dates, and disappear with the term after its end. Stale edits/removals are rejected using an event version. Imported classes remain separate from personal events.

Select a class to see its meetings and **Get directions to [building]**. Each distinct meeting location gets its own button. The link removes room suffixes (e.g. Pearce Hall 137 → Pearce Hall), opens Maps with that building search, and leaves match selection and route confirmation to the student. Online/TBA/URL locations do not show a directions button. The room remains visible in the class details.

## Storage and API

Migration `f0d6c43a875e` adds private, versioned `schedule_events`. Migration `e9c5b32f764d` adds `schedule_terms` and `schedule_courses` to the existing messaging database. Terms are unique per user/season/year; courses per term/section. Validated course metadata and recurring meetings are stored as JSON. Imports and removals lock the user row to serialize concurrent edits; preview fingerprints reject stale commits. Ended terms cannot be reactivated by changing dates in an import.

All endpoints require bearer authentication and scope database access to the signed-in student:

- `GET /api/schedule`: current/upcoming terms and courses, campus date/timezone.
- `POST /api/schedule/preview`: parse/validate without persisting.
- `POST /api/schedule/import`: atomically save selected sections.
- `POST /api/schedule/courses/{id}/remove`: remove an owned current/upcoming class after the UI confirmation.

Apply migrations with `uv run --locked alembic upgrade head` in `backend`. The local `campus_buildout` PostgreSQL database has been migrated. EC2 has not been changed by this task. Deployment must include this migration before serving the updated application.

## Verification and limits

- Backend regression suite: 65 tests passed, including 14 schedule cases covering privacy, append, deduplication, changed details, stale previews, term isolation/expiration, bounds, multiline meetings and malformed rows.
- PostgreSQL smoke check: imported the normalized six-course sample, read it back, and verified deduplication within a transaction that was rolled back.
- Frontend suite: 84 tests passed, including schedule recurrence, DST-safe date arithmetic and overlap columns.
- Expo lint and TypeScript checks passed; web/iOS/Android export completed.
- Browser: rendered the real local Expo calendar. An isolated harness using the same Schedule components, real web document picker and schedule API with an in-memory test database successfully selected, reviewed, and saved the seven-row example as six courses (19 credits), preserving the BIO lecture and lab.
- Physical iPhone/Android file picking has not been tested. A fresh development build is needed for the new Expo DocumentPicker native module. An export is not a device runtime test.

Deferred: month view, academic-holiday exceptions, editing saved term boundaries, calendar notifications, and server-configured university term dates.

Browser verification for this update used isolated event storage and the real campus building database: saved without a location, selected/saved Pearce Hall, replaced it with a pin, dragged/saved the pin, and opened a class-to-map building search. The real app starts with a blank calendar. The exact supplied CSV is a regression fixture; it is not preloaded into student accounts. Physical-device pin dragging remains unverified.
