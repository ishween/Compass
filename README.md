# 🧭 Compass

A personal **work, growth & karma tracker** — a single-page web app with no backend and no build step. Your data stays in your own browser (`localStorage`).

**Live app:** https://ishween.github.io/Compass

## Features
- **Work items** with title, description, deadline, linked items, status pipeline (To be prioritized → Prioritized → In progress → Done), feelings during/after, impact, strengths, values, and buckets/sub-tags.
- **Buckets:** Engineering Leadership · O-1A/EB1A · Speaker (Conference, TEDx, Newsletter, LinkedIn, YouTube…) · Research (Papers, Book) · Psychology/Neuroscience.
- **Sort & filter** by deadline, status, bucket, recency, impact.
- **Charts** — focus by bucket, status pipeline, deadline horizon, impact, strengths & values explored.
- **Insights** — a reflection engine that surfaces amplifying strengths, under-practiced areas, values lived vs. unrealized, focus concentration, and scarce areas.
- **Karma / gamification** — daily per-bucket karma, streaks, and a weekly review heatmap.
- **Export / Import** your data as JSON for backup and portability.

## Run locally
It's a static site, so any static server works:

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173. (Opening `index.html` directly via `file://` won't run the scripts — serve it.)

## Data storage
All data is stored in the browser's `localStorage` under the key `compass.v1`. It is **per-browser and per-device** — it does not sync across devices. Use the **Export** button regularly to keep a JSON backup.
