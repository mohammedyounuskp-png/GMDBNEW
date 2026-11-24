# GM Sales Dashboard

Static dashboard (no build step, no backend). Deployable on Vercel as-is.

## Structure
| File | Purpose |
|---|---|
| `index.html` | Page shell and styles |
| `core.js` | Data model and pivot maths |
| `data.js` | Built-in data (aggregated from `data/GM_DB.xlsx`) |
| `app.js` | UI, filters, charts, Excel upload, report download |
| `vendor/xlsx.full.min.js` | SheetJS, reads uploaded Excel files in the browser |
| `data/GM_DB.xlsx` | Source workbook (reference copy) |

## Run locally
    npx serve .        # or: python3 -m http.server 8000

## Deploy
1. Push this folder to a GitHub repo.
2. On vercel.com choose **Add New > Project**, import the repo.
3. Framework Preset: **Other**. Leave build command and output directory empty. Click Deploy.

## Updating data
Open the live dashboard and use the **Upload** button to load a new `GM_DB.xlsx` (stays in that browser only).
To change the built-in data for everyone, replace `data.js` with a version regenerated from the new workbook.
