import { TruncatedCode } from '~/components/common/truncated-code'
import type { ToolCall } from '~/lib/archive/model'

/** Рендер вызова инструмента по форме `call` (см. §3.2, слой 2 плана) — не по имени инструмента. */
export function ToolCallView({ call }: { call: ToolCall }) {
  switch (call.kind) {
    case 'filePresent':
      return (
        <ul className="list-disc space-y-0.5 pl-4">
          {call.paths.map((path) => (
            <li key={path} className="font-mono text-xs">
              {path}
            </li>
          ))}
        </ul>
      )

    case 'fileEdit':
      return (
        <div className="space-y-2">
          <p className="truncate font-mono text-xs text-muted-foreground">{call.path}</p>
          <pre className="overflow-x-auto rounded bg-destructive/10 p-2 text-xs text-destructive">
            <code>{`- ${call.oldText}`}</code>
          </pre>
          <pre className="overflow-x-auto rounded bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-400">
            <code>{`+ ${call.newText}`}</code>
          </pre>
        </div>
      )

    case 'fileWrite':
      return (
        <div className="space-y-1.5">
          <p className="truncate font-mono text-xs text-muted-foreground">{call.path}</p>
          <TruncatedCode code={call.text} language={call.language} />
        </div>
      )

    case 'command':
      return <TruncatedCode code={call.command} language={call.language} />

    case 'fetch':
      return (
        <a
          href={call.url}
          target="_blank"
          rel="noreferrer"
          className="break-all text-sm text-foreground underline-offset-2 hover:underline"
        >
          {call.url}
        </a>
      )

    case 'query':
      return <p className="text-sm">{call.query}</p>

    case 'fileRead':
      return (
        <p className="font-mono text-xs text-muted-foreground">
          {call.path}
          {call.range && ` (${call.range[0]}–${call.range[1]})`}
        </p>
      )

    case 'raw':
      return <pre className="overflow-x-auto rounded bg-background p-2 text-xs">{JSON.stringify(call.input, null, 2)}</pre>

    case 'none':
      return null
  }
}
