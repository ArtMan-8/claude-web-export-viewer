# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, offline, read-only viewer for the claude.ai data export (Settings → Account → Export data). The user drops `manifest-*.json` + `conversations-*.zip` / `projects-*.zip` / `frames-*.zip` / `light_metadata-*.zip` onto the page; everything is unzipped, parsed, and rendered in the browser. No backend, no uploads. Deployed to GitHub Pages from `trunk` via `.github/workflows/deploy-pages.yml` (tests + build with `GITHUB_PAGES=true`).

Code comments, docs, and i18n source strings are written in Russian; commit messages are English conventional commits (`feat(scope): …`, `fix(scope): …`, `doc: …`, `refactor: …`).

## Commands

```bash
npm run dev                                     # Vite dev server; auto-loads ./claude-data/ if present (see below)
npm run build                                   # tsc -b && vite build (type-check is part of the build — there is no separate lint step)
npm test                                        # vitest run (node environment, globals on)
npm run test:watch
npx vitest run src/lib/archive/thread.test.ts   # single test file
npx vitest run -t "name substring"              # single test by name
```

There is no ESLint/Prettier config; `tsc` with `noUnusedLocals`/`noUnusedParameters`/`verbatimModuleSyntax` is the only gate.

### Local archive in dev

`vite.config.ts` has a dev-only `localArchive()` plugin that serves `./claude-data/*.{zip,json}` (override dir with `LOCAL_ARCHIVE_DIR`) at `/__local-archive/{list,file/<name>}`. `AppGate` calls `tryLoadLocalArchive()` once on start, so a real export dropped into `claude-data/` loads without drag-and-drop. `claude-data/` is gitignored and contains real personal data — never read it into commits, tests, or fixtures. Tests use anonymous builders from `src/test-fixtures/fixtures.ts`.

## Architecture

### Data pipeline (`src/lib/archive/`)

The whole app hinges on one pure function, `buildArchive(files: RawFileInput[]): Archive` (`build-archive.ts`), which runs synchronously in the main thread:

1. **`load.ts` → `loadRawArchive`** — unzips with `fflate`, then classifies every JSON entry **by shape, not by filename** (`looksLikeConversation`/`looksLikeProject`/`looksLikeUser`/`looksLikeArtifactMeta`), because the export's file naming has changed between versions. Also handles the old flat format (`projects.json` as an array). `.html` entries are collected into `artifactHtml` by inner zip path. Manifest (`manifest.ts`) is only used for `created_at` and to warn about missing files. Throws `ArchiveLoadError(code)` only when nothing at all was recognised; everything else becomes a `LoadWarning { code, params }` whose `code` is an i18n key (`errors.*` / `warnings.*` in `src/i18n/locales/*.json`).
2. **`normalize.ts`** — maps `raw-types.ts` (the export's JSON shape) to `model.ts` (the domain model). Tool blocks are recognised **by the shape of `input` / `content[]`**, not by tool name, producing the `ToolCall` / `ToolResult` discriminated unions. A `FieldDetector` records unknown block types, result item types, and keys outside per-context whitelists, and emits them as warnings — when the export format grows, these warnings are the first signal. Also detects "deleted" conversations/projects (skeletons with content wiped) and reconstructs conversation files from `fileWrite`/`fileEdit` tool calls (`ConversationFile.reconstructionError` when replay fails).
3. **`link-projects.ts`** — the export has no conversation→project link; it is recovered heuristically by matching `project_knowledge_search` result fragments (first line = doc filename) to project docs. Ties are left unlinked on purpose.
4. **`thread.ts`** — builds the message tree from `parent_message_uuid`, picks the main branch by latest `created_at` at each fork, and exposes `resolvePath` for the branch switcher; falls back to array order on cycles/broken refs.

**Boundary rule:** `raw-types.ts` must not leak outside `src/lib/archive/`. Components consume only `model.ts` types. The `raw` field on `Conversation`/`Project` exists solely for the "raw JSON" export mode and is not to be read by UI.

Design decisions and the full field map for each export format revision live in `docs/*-plan-export-format.md` (numbered questions like "Q8", "§3.2" in code comments refer to those documents). When supporting a new export format, follow the existing pattern: write/extend the plan doc, then extend raw-types → normalize → model → UI → export, keeping tests alongside each `lib` module.

### State and routing

- `src/store/archive-store.tsx` — single `ArchiveProvider` context holding `Archive | null`, load status, and memoised search indexes (`src/lib/search/`, built from text blocks only, lowercased once; deleted records excluded). `settings-store.tsx` persists theme / showTools / showPII to `localStorage`.
- TanStack Router with file-based routes in `src/routes/` (`@tanstack/router-plugin` generates the gitignored `src/routeTree.gen.ts`; `autoCodeSplitting` is on). `__root.tsx` wraps everything in providers and `AppGate`, which shows `ArchiveDropzone` until status is `ready`, then `AppShell`. Each section (`conversations`, `projects`, `artifacts`) has a `route.tsx` layout with a list panel + `<Outlet>`, an `index.tsx`, and a `$uuid.tsx`/`$id.tsx` detail route that looks the entity up in the archive by id.
- `basepath` comes from `import.meta.env.BASE_URL`; Vite `base` is `/claude-web-export-viewer/` when `GITHUB_PAGES` is set, and `spaFallback404()` copies `index.html` to `404.html` for Pages SPA routing.

### UI

- shadcn (radix-nova style) components in `src/components/ui/`; feature components grouped by domain (`conversation/`, `project/`, `artifact/`, `dashboard/`, `account/`, `layout/`). Message rendering dispatches on `Block.kind` in `components/conversation/blocks/`.
- Import alias is `~` → `src/` (not `@`).
- Artifacts render in a sandboxed `<iframe srcdoc>`; `src/lib/artifact-html.ts` injects `<base href="about:srcdoc">` so in-page anchors work. The iframe is keyed so `sandbox` changes remount it.
- ```` ```mermaid ```` fences in any `<Markdown>` render as diagrams: `mermaid-diagram.tsx` lazy-loads the `mermaid` chunk (`securityLevel: 'strict'`, re-rendered on theme change; `look: 'classic'` + `layout: 'dagre'` because mermaid 12 defaults to ELK/neo, which draws orthogonal edges and pulls a 1.4 MB chunk), shows a fixed-height (500px) fitted preview, and opens `diagram-viewer.tsx` (Dialog with CSS-transform pan/zoom) full screen. Parse failures fall back to the plain code block. Content passed through `TruncatedCode` (tool bodies, conversation files) is deliberately not rendered as diagrams.
- i18n: `react-i18next` with `ru`/`en` dictionaries; every user-visible string goes through `t()`, and warning/error codes from the lib map to keys in those dictionaries — add both languages when adding a code.
- Export (`src/lib/export/`) produces Markdown/JSON per conversation and a whole-archive zip (`zip-all.ts`), reusing the same `ToolCall`/`ToolResult` shape dispatch as the UI.
