# Claude Web Export Viewer

A local, read-only viewer for the data export you get from [claude.ai](https://claude.ai) (Settings → Account → Export data). Drop the exported files onto the page and browse your conversations and projects — everything is parsed and rendered entirely in the browser, nothing is uploaded anywhere.

## Features

- **Drag-and-drop import** of the export as-is: the `manifest-*.json` plus the `conversations-*.zip`, `projects-*.zip`, and `light_metadata-*.zip` archives (loose `.json` files also work).
- **Dashboard** with archive-wide stats: conversation/message/project/document counts, date range, and most-used tools.
- **Conversation browser** with full message threads, rendered Markdown, code highlighting, thinking blocks, and tool use/result blocks.
- **Project browser** with project documents (Markdown and CSV rendered natively), a collapsible description, and conversations linked back via a heuristic — the export doesn't record which project a conversation belongs to, so links are recovered by matching `project_knowledge_search` results to document filenames.
- **Full-text search** across conversations, thinking blocks, and tool content.
- **Export** individual conversations to Markdown/JSON, or the whole archive to a single zip.
- **English/Russian UI** with automatic language detection.
- **Light/dark theme.**

## Getting your export

1. In claude.ai, go to **Settings → Account → Export data** and request an export.
2. Download the zip you receive by email — it contains a `manifest-*.json` and one or more `*.zip` data files.
3. Open this app and drop those files onto the import screen.

## Development

```bash
npm install
npm run dev       # start the dev server
npm run build      # type-check and build for production
npm run preview    # preview the production build
npm test           # run tests
```

## Tech stack

React 19, TypeScript, Vite, TanStack Router, Tailwind CSS, Radix UI, i18next, `fflate` for in-browser zip handling.

## Privacy

All parsing and rendering happens client-side in your browser. Your export data is never sent to a server — the built app is static and works fully offline.

## License

MIT — see [LICENSE](./LICENSE).
