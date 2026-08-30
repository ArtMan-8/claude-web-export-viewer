import { useMemo } from 'react'
import Papa from 'papaparse'
import { useTranslation } from 'react-i18next'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'

export function CsvTable({ content }: { content: string }) {
  const { t } = useTranslation()

  const parsed = useMemo(() => Papa.parse<string[]>(content, { skipEmptyLines: true }), [content])
  const [header, ...rows] = parsed.data

  if (!header || header.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('project.emptyCsv')}</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {header.map((cell, i) => (
              <TableHead key={i}>{cell}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell key={j}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
