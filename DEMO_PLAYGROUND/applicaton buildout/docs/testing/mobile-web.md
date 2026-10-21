# Mobile web layout pass — October 14, 2026

Changes in `applicaton buildout`:

- Below 760px, Schedule renders a week/day agenda with full event titles, times and
  locations. The page scrolls naturally instead of nesting a tall hourly timeline.
  Desktop keeps the original weekly grid and its day option. Lecture/lab blocks
  remain separate and tappable. Empty days and out-of-term dates are labeled.
- On narrow screens, Maps prioritizes the canvas. Search/directions sit in a
  collapsible panel below it; the panel is independently scrollable. The main
  destination field comes before saved places, following controls and reports.
  Directions links from classes open the panel automatically.
- The web map initially fits the campus extent on phone-sized canvases instead of
  assuming a desktop zoom. User panning is preserved; selected destinations/routes
  are refitted when the available canvas changes. Provider attribution remains
  accessible in the map's compact attribution control.
- The inbox uses a compact header, stronger name/preview contrast, separated rows,
  and an explicitly shrinking/scrolling list. Small-screen composer padding is
  reduced while preserving 44–48px controls. Desktop keeps its two-column layout.
- Web inputs use at least 16px text on phones. Dynamic viewport height and the
  visual viewport resize event account for browser bars/keyboard height while
  preserving pinch zoom. The visual viewport listener is web-only and cleaned up.

Validation: phone-sized browser checks at 390×844 and 375×667, including signed-in
inbox, schedule agenda, expanded/collapsed map panel. The smaller screen had a
375px document width and a 257px-high map while the panel was open; no document
horizontal overflow. Tests cover lecture plus lab text in the agenda and existing
web rendering/hydration. Lint, TypeScript and platform export checks are run.

These browser viewport checks do not simulate physical iPhone Safari, notches or
its software keyboard. On-device acceptance still needs: focus search/message and
calendar inputs, dismiss keyboard, rotate, pinch zoom, open class details, scroll
the entire agenda and map panel, and navigate back from chat. No cloud deployment
is performed by this layout pass. Redeploy the current application when ready.
