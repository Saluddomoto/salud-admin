import { NextResponse } from 'next/server'
import { linePush } from '@salud/line'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['admin', 'manager'].includes(me.role)) {
    return NextResponse.json({ error: 'admin/manager 権限が必要です' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const assignedUserId = typeof body?.assigned_user_id === 'string' ? body.assigned_user_id : ''
  const title    = typeof body?.title === 'string' ? body.title : ''
  const dueDate  = typeof body?.due_date === 'string' ? body.due_date : null
  if (!assignedUserId || !title) {
    return NextResponse.json({ error: 'assigned_user_id と title は必須です' }, { status: 400 })
  }

  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!accessToken) {
    return NextResponse.json({ ok: true, notified: false, reason: 'LINE 未設定' })
  }

  const admin = createAdminClient()
  const { data: assignee } = await admin
    .from('profiles')
    .select('full_name, line_user_id')
    .eq('id', assignedUserId)
    .maybeSingle()

  if (!assignee?.line_user_id) {
    return NextResponse.json({ ok: true, notified: false, reason: 'LINE未登録' })
  }

  const lines = [
    '新しいタスクが依頼されました📋',
    `📝 ${title}`,
    dueDate ? `📅 期限: ${dueDate.slice(5).replace('-', '/')}` : null,
  ].filter(Boolean) as string[]

  try {
    await linePush(assignee.line_user_id, [{ type: 'text', text: lines.join('\n') }], accessToken)
    return NextResponse.json({ ok: true, notified: true })
  } catch (e) {
    console.error('notify-task: push failed', e)
    return NextResponse.json({ ok: true, notified: false, reason: '送信失敗' })
  }
}
