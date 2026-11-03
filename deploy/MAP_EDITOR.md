# Local campus OSM editor

Stop any existing `make dev` process, then run `make map-editor` from the repository
root. Open http://localhost:8081/map-editor (or the **Map editor** tab). Docker must
be running for the normal local app database. This enables a local-only editing
endpoint; normal `make dev`, container deployments, and authenticated production
leave it disabled. Do not expose the development server through a public tunnel.

## Editing

- Search by name, amenity/type, or `way/123` / `node/123`, or select a map object.
- Edit, add, or remove tag keys and values, then **Apply tags**. A lot's label is
  its `name` tag; its function is normally `amenity=parking`.
- Selected ways display blue draggable vertices. Click **+** between vertices to
  insert another, then drag it. Click a vertex for removal or entrance tagging.
- Enable **Insert entrances at midpoint handles** and click **E** to insert an
  `entrance=yes` node into the outline. Set verified accessibility/entrance details
  in its tags. Use the parent-way button to return to boundary editing.
- Shared nodes are red and locked. **Detach shared vertices** explicitly copies
  those nodes and tags into the selected way, leaving neighboring ways unchanged.
  This disconnects topology; avoid detaching an entrance connected to a footpath
  unless that disconnection is intentional.
- Create a building, lot, or other area by clicking each corner and choosing
  **Finish boundary**. New objects get negative IDs, unique within their OSM type.
- Relation tags remain editable; choose a member way to edit its outline. The
  editor preserves relations but does not create new multipolygon relations or
  holes. Referenced objects cannot be deleted directly; inspect their parents.
- **Undo/Redo** retain up to ten operations. Unapplied tag edits and unfinished
  drawings must be applied/finished or cancelled before saving or exporting.

## Saving and recovery

**Save OSM file** writes `data/greater_cmu_area.osm`, which is also served through
`front_end/public/data`. Each save creates a timestamped copy of the previous file
under ignored `data/.osm-backups/`, then atomically replaces the campus file.
Backups are retained until you remove them. **Export draft** downloads a separate
OSM file; it does not overwrite the repository file.

A revision hash prevents overwriting changes saved by another tab or made on disk.
If there is a conflict, export your draft, then reload and reconcile it with the
new file. To restore a backup, stop editing, copy the desired `.osm` backup over
`data/greater_cmu_area.osm`, then reload. Review the data diff before committing it.
Changes are local dataset changes, never uploads to OpenStreetMap.

The validator checks XML structure, IDs, coordinates, tag uniqueness, and object
references. Existing references outside this downloaded extract are preserved;
new dangling references are rejected. It does not certify surveyed accuracy or
validate every geometric/topological rule (for example polygon self-intersections).

The background raster tiles are independent. Turn **Show background tiles** off
when comparing edited objects. Reload the ordinary map after saving. Changes to
the bundled dataset reach the public site only after a new frontend build/deploy.

## Verification

- `make test-api`: save/backup/conflict/validation and local-access tests use
  temporary files, never the campus dataset.
- `make test-map-editor`: XML editing tests for vertex insertion/removal, shared
  node detachment, references, polygon IDs, and metadata/tag roundtrips.
- `make validate`: backend and frontend formatting, lint, and type checking.
