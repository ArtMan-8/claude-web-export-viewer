import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useArchive } from '@/store/archive-store'
import { useSettings } from '@/store/settings-store'

function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '•••'
  const name = email.slice(0, at)
  const visible = name.slice(0, Math.min(2, name.length))
  return `${visible}${'•'.repeat(Math.max(name.length - visible.length, 3))}@${email.slice(at + 1)}`
}

function maskIp(ip: string): string {
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.•.•`
  return ip.replace(/[0-9a-fA-F]/g, '•')
}

function initials(fullName: string): string {
  return (
    fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  )
}

function formatTimestamp(iso: string): string {
  return iso ? iso.replace('T', ' ').slice(0, 16) : '—'
}

export function AccountPage() {
  const { archive } = useArchive()
  const { showPII, setShowPII } = useSettings()

  if (!archive) return null
  const user = archive.users[0] ?? null

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Аккаунт</h1>
        <div className="flex items-center gap-2">
          <Label htmlFor="show-pii" className="text-sm text-muted-foreground">
            Показать email и IP
          </Label>
          <Switch id="show-pii" checked={showPII} onCheckedChange={setShowPII} />
        </div>
      </div>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle>Профиль</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user.fullName || '—'}</p>
              <p className="text-sm text-muted-foreground">{showPII ? user.email : maskEmail(user.email)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>История входов ({archive.loginEvents.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {archive.loginEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных об истории входов</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Браузер</TableHead>
                  <TableHead>ОС</TableHead>
                  <TableHead>Гео</TableHead>
                  <TableHead>Способ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archive.loginEvents.map((event, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{formatTimestamp(event.timestamp)}</TableCell>
                    <TableCell className="whitespace-nowrap">{showPII ? event.ip : maskIp(event.ip)}</TableCell>
                    <TableCell>{event.browser || '—'}</TableCell>
                    <TableCell>{event.os || '—'}</TableCell>
                    <TableCell>{[event.city, event.region, event.country].filter(Boolean).join(', ') || '—'}</TableCell>
                    <TableCell>{event.method || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
