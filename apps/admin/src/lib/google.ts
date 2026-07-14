// Google カレンダー連携（サーバー専用）
// 各メンバーが選んだ1つのカレンダーだけを読み取り、events テーブルへ同期する。
// プライバシー方針: 選択されたカレンダー以外は読まない。
import { createAdminClient } from '@/lib/supabase-admin'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CAL_API   = 'https://www.googleapis.com/calendar/v3'
const SYNC_INTERVAL_MS = 10 * 60_000 // 同一接続の再同期は10分に1回まで

export function googleRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI
    || `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  googleRedirectUri(),
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/calendar.readonly',
    access_type:   'offline',
    prompt:        'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeCode(code: string): Promise<{ refresh_token?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  googleRedirectUri(),
      grant_type:    'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function accessTokenFor(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`)
  return (await res.json()).access_token as string
}

export async function listCalendars(refreshToken: string): Promise<{ id: string; summary: string; primary?: boolean }[]> {
  const token = await accessTokenFor(refreshToken)
  const res = await fetch(`${CAL_API}/users/me/calendarList?minAccessRole=reader`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`calendarList failed: ${res.status}`)
  const json = await res.json()
  return (json.items ?? []).map((c: { id: string; summary: string; primary?: boolean }) =>
    ({ id: c.id, summary: c.summary, primary: c.primary }))
}

type GoogleEvent = {
  id: string
  status: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?:   { dateTime?: string; date?: string }
}

// UTCエポックms → JST の日付・時刻文字列
function toJst(ms: number): { date: string; time: string } {
  const iso = new Date(ms + 9 * 3600_000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

/** 接続済みメンバー全員のカレンダーを events へ同期する */
export async function syncGoogleCalendars(opts: { force?: boolean } = {}): Promise<{ synced: number; skipped: number }> {
  const admin = createAdminClient()
  const { data: conns } = await admin
    .from('google_calendar_connections')
    .select('user_id, refresh_token, calendar_id, last_synced_at')
    .not('calendar_id', 'is', null)

  let synced = 0, skipped = 0
  const now = Date.now()

  for (const conn of conns ?? []) {
    if (!opts.force && conn.last_synced_at
        && now - new Date(conn.last_synced_at).getTime() < SYNC_INTERVAL_MS) {
      skipped++
      continue
    }
    try {
      const token = await accessTokenFor(conn.refresh_token)
      const params = new URLSearchParams({
        timeMin: new Date(now - 7 * 86_400_000).toISOString(),
        timeMax: new Date(now + 60 * 86_400_000).toISOString(),
        singleEvents: 'true',
        showDeleted: 'true',
        maxResults: '250',
      })
      const res = await fetch(
        `${CAL_API}/calendars/${encodeURIComponent(conn.calendar_id!)}/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error(`events.list failed: ${res.status}`)
      const items = ((await res.json()).items ?? []) as GoogleEvent[]

      const rows = []
      const cancelled: string[] = []
      for (const ev of items) {
        const gid = `${conn.user_id}:${ev.id}`
        if (ev.status === 'cancelled') { cancelled.push(gid); continue }
        let event_date: string, start_time: string, end_time: string
        if (ev.start?.dateTime) {
          const s = toJst(Date.parse(ev.start.dateTime))
          const e = toJst(Date.parse(ev.end?.dateTime ?? ev.start.dateTime))
          event_date = s.date; start_time = s.time; end_time = e.time
        } else if (ev.start?.date) {
          event_date = ev.start.date; start_time = '00:00'; end_time = '23:59' // 終日
        } else continue
        const title = ev.summary || '（無題）'
        // タイトルに「商談/営業」が含まれれば商談(sales)、それ以外は打ち合わせ(meeting)として扱う
        const category = /商談|営業/.test(title) ? 'sales' : 'meeting'
        rows.push({
          google_event_id:  gid,
          title,
          event_date, start_time, end_time,
          category,
          assigned_user_id: conn.user_id,
          created_by:       conn.user_id,
          notes:            'Google カレンダーから同期',
        })
      }

      if (rows.length) {
        const { error } = await admin.from('events').upsert(rows, { onConflict: 'google_event_id' })
        if (error) throw error
      }
      if (cancelled.length) {
        await admin.from('events').delete().in('google_event_id', cancelled)
      }
      await admin.from('google_calendar_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('user_id', conn.user_id)
      synced++
    } catch (e) {
      console.error(`google sync failed for user ${conn.user_id}`, e)
    }
  }
  return { synced, skipped }
}
