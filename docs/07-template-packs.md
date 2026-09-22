# Template pack format

Adding a second template = **new folder under `templates/` + `manifest.json`**.  
The server loads every subdirectory that contains a valid manifest at startup (`RESUME_TEMPLATES_DIR` overrides the default `./templates` next to the repo root).

## Layout

```
templates/
  blue-black-simple/          # folder slug (filesystem name)
    manifest.json             # required — id, displayName, styles, layout, …
    # optional later: preview.png, fonts/, …
```

## `manifest.json` fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Stable contract id (e.g. `default-v1`). Stored on resumes. |
| `slug` | yes | Folder / human slug (e.g. `blue-black-simple`). |
| `displayName` | yes | UI label (e.g. **蓝黑简洁简历**). |
| `version` | yes | Semver string written into ResumeIR `templateVersion`. |
| `description` | no | Shown in template picker. |
| `photoInTemplate` | yes | Whether this pack shows a portrait when the applied profile has a photo. |
| `photo` | no | `{ placement, widthPx, heightPx }`. Blue-black-simple uses `above-name-center` + 98×131. |
| `layout` | no | Tab stops / bullet indent in twips: `entryTabCenter` (4933), `internshipTabCenter` (6520), `entryTabRight` (9866), `bulletIndent`. |
| `sectionOrder` | yes | Module sections after education/skills header: `skills` \| `projects` \| `internships` \| `awards`. Skills in this list are skipped for placements (rendered from `Profile.skills`). |
| `page` | yes | DOCX page size/margins in twips (`width`, `height`, `margin`). |
| `styles` | yes | Text styles for IR runs: `name`, `tagline`, `contact`, `sectionHeading`, `entryTitle`, `entryMeta`, `skillLine`, `body`. Each may set `bold`, `fontSizePt`, `fontEastAsia`. |

## How the runtime uses it

1. `apps/server` → `loadTemplateRegistry()` reads `templates/*/manifest.json`.
2. `GET /api/templates` returns `{ id, label: displayName, description }[]`.
3. `renderToIR` / DOCX export look up styles, page, photo size, and tab centers by `templateId`.
4. Web `ResumeCanvas` mirrors the same visual rules in CSS (photo above name, three-column entries).

## Adding a template

1. Copy `templates/blue-black-simple/` to `templates/<your-slug>/`.
2. Edit `manifest.json`: new unique `id` + `displayName` + styles/order/layout as needed.
3. Restart the server (registry loads once at process start).
4. Pick the new name under **选择简历模板**.

Typography-only variants that still use the same IR layout rules (header → education → profile skills → ordered sections) need no code change. Layout-algorithm forks need a new renderer keyed by `id` (future work).
