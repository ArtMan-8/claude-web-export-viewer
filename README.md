# Claude Web Export Viewer

A local, read-only viewer for the data export you get from [claude.ai](https://claude.ai) (Settings → Account → Export data). Drop the exported files onto the page and browse your conversations, projects, and artifacts — everything is parsed and rendered entirely in the browser, nothing is uploaded anywhere.

**Try it online:** https://artman-8.github.io/claude-web-export-viewer/ — it's a static page; your files stay in your browser.

## Features

- **Drag-and-drop import** of the export as-is: the `manifest-*.json` plus the `conversations-*.zip`, `projects-*.zip`, `frames-*.zip`, and `light_metadata-*.zip` archives (loose `.json` files also work).
- **Dashboard** with archive-wide stats: conversation/message/project/document counts, date range, most-used tools, and a list of deleted conversations and projects (the export keeps their skeletons).
- **Conversation browser** with full message threads and branch switching, rendered Markdown, code highlighting, thinking blocks, tool use/result blocks, and user attachments. Files Claude created during a conversation are reconstructed from its file-write/edit tool calls and shown alongside the thread.
- **Project browser** with project documents in a folder tree (Markdown and CSV rendered natively), a collapsible description, and conversations linked back via a heuristic — the export doesn't record which project a conversation belongs to, so links are recovered by matching `project_knowledge_search` results to document filenames.
- **Artifact browser** with all versions of each artifact, rendered live in a sandboxed iframe.
- **Mermaid diagrams** in any Markdown, with a full-screen pan/zoom viewer.
- **Full-text search** across conversation text and project documents (thinking blocks and tool bodies are not indexed).
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

To skip drag-and-drop while developing, put a real export into `./claude-data/` (gitignored) — the dev server picks it up automatically on start. Use `LOCAL_ARCHIVE_DIR=<path>` to point it elsewhere.

## Tech stack

React 19, TypeScript, Vite, TanStack Router, Tailwind CSS, Radix UI, i18next, `fflate` for in-browser zip handling, `mermaid` for diagrams.

## Privacy

All parsing and rendering happens client-side in your browser. Your export data is never sent to a server — the built app is static and works fully offline.

## License

MIT — see [LICENSE](./LICENSE).
