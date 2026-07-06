import { NextResponse } from 'next/server'
import { listCalendars } from '@/lib/google'
import { createAdminClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ログイン中ユーザーの Google 連携状態と、選択可能なカレンダー一覧を返す
export async function GET() {
  const { data: { user } } = await createServerSupabaseClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: conn } = await admin
    .from('google_calendar_connections')
    .select('calendar_id, calendar_name, last_synced_at, refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!conn) return NextResponse.json({ connected: false })

  let calendars: { id: string; summary: string }[] = []
  try {
    calendars = await listCalendars(conn.refresh_token)
  } catch (e) {
    console.error('listCalendars failed', e)
  }

  return NextResponse.json({
    connected:      true,
    calendar_id:    conn.calendar_id,
    calendar_name:  conn.calendar_name,
    last_synced_at: conn.last_synced_at,
    calendars,
  })
}

// カレンダー選択の保存 / 連携解除
export async function POST(req: Request) {
  const { data: { user } } = await createServerSupabaseClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json() as { action: 'select' | 'disconnect'; calendar_id?: string; calendar_name?: string }
  const admin = createAdminClient()

  if (body.action === 'disconnect') {
    await admin.from('google_calendar_connections').delete().eq('user_id', user.id)
    await admin.from('events').delete().eq('assigned_user_id', user.id).not('google_event_id', 'is', null)
    return NextResponse.json({ ok: true })
  }

  if (!body.calendar_id) return NextResponse.json({ error: 'calendar_id required' }, { status: 400 })
  const { error } = await admin
    .from('google_calendar_connections')
    .update({ calendar_id: body.calendar_id, calendar_name: body.calendar_name ?? null, last_synced_at: null })
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
