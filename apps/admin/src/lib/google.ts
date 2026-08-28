// Google カレンダー連携（サーバー専用）
// 各メンバーが選んだ1つのカレンダーだけを読み取り、events テーブルへ同期する。
// プライバシー方針: 選択されたカレンダー以外は読まない。
import { createAdminClient } from '@/lib/supabase-admin'

const TOKEN_URL  = 'https://oauth2.googleapis.com/token'
const CAL_API    = 'https://www.googleapis.com/calendar/v3'
const DRIVE_API  = 'https://www.googleapis.com/drive/v3'
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
    scope:         'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.readonly',
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
  creator?: { email?: string; displayName?: string }
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

  // 予定の実際の作成者をメールアドレスで突き止めるためのマップ。
  // 共有カレンダー（例: 社内用）は1人しか接続していなくても、他メンバーが
  // 自分のGoogleアカウントでその予定を作成していれば creator.email で判別できる。
  // is_active な profiles のみを対象にする（テスト用ダミーアカウント等の
  // 非アクティブなプロフィールに紐付いてしまわないようにするため）。
  const [{ data: authUsers }, { data: activeProfiles }] = await Promise.all([
    admin.auth.admin.listUsers(),
    admin.from('profiles').select('id').eq('is_active', true),
  ])
  const activeProfileIds = new Set((activeProfiles ?? []).map(p => p.id))
  const emailToProfileId = new Map(
    (authUsers?.users ?? [])
      .filter(u => u.email && activeProfileIds.has(u.id))
      .map(u => [u.email!.toLowerCase(), u.id] as const),
  )

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
        // 予定の実作成者（Googleカレンダー上のcreator）が判明すればその人に、
        // 不明・社外ゲスト等の場合のみカレンダー接続者（conn.user_id）にフォールバック
        const creatorEmail = ev.creator?.email?.toLowerCase()
        const ownerId = (creatorEmail && emailToProfileId.get(creatorEmail)) || conn.user_id
        rows.push({
          google_event_id:  gid,
          title,
          event_date, start_time, end_time,
          category,
          assigned_user_id: ownerId,
          created_by:       ownerId,
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

type DriveFile = { id: string; name: string; createdTime?: string }

// 「Meet Recordings」フォルダ（Google Meet の Gemini メモが自動保存される、
// 各ユーザーのマイドライブ直下にある既定フォルダ）を検索して ID を返す
async function findMeetRecordingsFolderId(token: string): Promise<string | null> {
  const q = "name = 'Meet Recordings' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
  const res = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`drive folder search failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.files?.[0]?.id ?? null
}

async function exportDocText(fileId: string, token: string): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}/export?mimeType=text/plain`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`drive export failed: ${res.status} ${await res.text()}`)
  return res.text()
}

/**
 * 接続済みメンバーの「Meet Recordings」フォルダを見て、新しい Google Meet 議事録
 * (Gemini が自動生成する Google ドキュメント)を meeting_notes に取り込む。
 * Docs のタブ機能（メモ/文字起こし）のうち、既定表示される先頭タブ(メモ=要約)のみ取り込む。
 */
export async function syncGoogleMeetMinutes(opts: { force?: boolean } = {}): Promise<{ processed: number; checked: number; errors: string[] }> {
  const admin = createAdminClient()
  const { data: conns } = await admin
    .from('google_calendar_connections')
    .select('user_id, refresh_token, drive_meet_folder_id, drive_last_synced_at')

  let processed = 0, checked = 0
  const errors: string[] = []
  const now = Date.now()

  for (const conn of conns ?? []) {
    if (!opts.force && conn.drive_last_synced_at
        && now - new Date(conn.drive_last_synced_at).getTime() < SYNC_INTERVAL_MS) {
      continue
    }
    try {
      const token = await accessTokenFor(conn.refresh_token)

      let folderId = conn.drive_meet_folder_id
      if (!folderId) {
        folderId = await findMeetRecordingsFolderId(token)
        if (!folderId) {
          errors.push(`${conn.user_id}: Meet Recordings フォルダが見つかりません`)
          continue
        }
        await admin.from('google_calendar_connections')
          .update({ drive_meet_folder_id: folderId })
          .eq('user_id', conn.user_id)
      }

      const q = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`
      const params = new URLSearchParams({
        q,
        fields: 'files(id,name,createdTime)',
        orderBy: 'createdTime desc',
        pageSize: '25',
      })
      const res = await fetch(`${DRIVE_API}/files?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`drive files.list failed: ${res.status}`)
      const files = ((await res.json()).files ?? []) as DriveFile[]
      checked += files.length

      for (const f of files) {
        const summary = await exportDocText(f.id, token).catch(e => {
          console.error(`drive export failed for ${f.id}`, e); return null
        })
        if (summary == null) continue

        const { error } = await admin.from('meeting_notes')
          .upsert({
            drive_file_id: f.id,
            title:         f.name,
            meeting_date:  f.createdTime ?? null,
            summary,
            source:        'google_meet',
            created_by:    conn.user_id,
            updated_at:    new Date().toISOString(),
          }, { onConflict: 'drive_file_id' })
        if (error) { console.error('meeting_notes upsert failed', error); continue }
        processed++
      }

      await admin.from('google_calendar_connections')
        .update({ drive_last_synced_at: new Date().toISOString() })
        .eq('user_id', conn.user_id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`drive minutes sync failed for user ${conn.user_id}`, e)
      errors.push(msg)
    }
  }
  return { processed, checked, errors }
}
