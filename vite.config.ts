import fs from 'node:fs'
import path from 'node:path'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Отдаёт файлы локального архива (claude-data/) в dev-режиме, чтобы приложение
 * могло подхватить их без ручного перетаскивания. В прод-сборку не попадает.
 */
function localArchive(): Plugin {
  const dirName = process.env.LOCAL_ARCHIVE_DIR ?? 'claude-data'
  const allowed = /\.(zip|json)$/i

  return {
    name: 'local-archive',
    apply: 'serve',
    configureServer(server) {
      const dir = path.resolve(server.config.root, dirName)

      server.middlewares.use('/__local-archive', (req, res, next) => {
        const url = req.url ?? '/'

        if (!fs.existsSync(dir)) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: `Директория ${dirName} не найдена` }))
          return
        }

        if (url === '/list' || url.startsWith('/list?')) {
          const files = fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((entry) => entry.isFile() && allowed.test(entry.name))
            .map((entry) => ({
              name: entry.name,
              size: fs.statSync(path.join(dir, entry.name)).size,
            }))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ dir: dirName, files }))
          return
        }

        if (url.startsWith('/file/')) {
          const name = path.basename(decodeURIComponent(url.slice('/file/'.length)))
          const target = path.join(dir, name)

          if (!allowed.test(name) || !fs.existsSync(target)) {
            res.statusCode = 404
            res.end('Not found')
            return
          }

          res.setHeader('Content-Type', 'application/octet-stream')
          fs.createReadStream(target).pipe(res)
          return
        }

        next()
      })
    },
  }
}

/**
 * На GitHub Pages проектный сайт отдаётся по пути /<repo>/, а не с корня —
 * без этого base все ассеты после деплоя будут 404.
 */
function spaFallback404(): Plugin {
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve(import.meta.dirname, 'dist')
      fs.copyFileSync(path.join(outDir, 'index.html'), path.join(outDir, '404.html'))
    },
  }
}

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/claude-web-export-viewer/' : '/',
  plugins: [
    // Плагин роутера обязан идти перед react() — так требует его документация
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    localArchive(),
    spaFallback404(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
})
