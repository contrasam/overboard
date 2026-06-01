# overboard

Interactive storyboard tool for planning AI-generated video: shots, arrangement, layered audio markers that flow across multi-row timelines, and a pacing simulator.

## Stack

- **Client**: Vite + React + TypeScript
- **Server**: Hono + better-sqlite3 (SQLite file on disk)
- **Storage**: SQLite for storyboards/shots/audio markers, `server/data/uploads/` for shot images.

## Setup

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:5174

The Vite dev server proxies `/api` and `/uploads` to the Hono server.

## Concepts

- **Storyboard** — a named project with a px-per-second timeline scale.
- **Shot** — an ordered card with title, description, duration (seconds), and optional uploaded reference image. Shot width on the timeline is `durationSec * pxPerSecond`.
- **Multi-row layout** — shots flow left-to-right and wrap onto new rows when they exceed the row width.
- **Audio markers** — text-labeled bars on numbered lanes below each row. A marker has absolute start/end seconds; if it spans a row boundary, it visually continues on the next row.
- **Playback simulator** — press play to walk the timeline at 1×, highlighting the active shot and active audio markers so you can feel the pacing.
