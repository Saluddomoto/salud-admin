import { NextResponse } from 'next/server'
import { linePush } from '@salud/line'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 毎朝の LINE ダイジェスト（Vercel Cron から毎日 08:00 JST に起動）。
// 各メンバー（profiles.line_user_id 登録者）に、本人の今日の予定・期限タスク・
// 全体の要返信メッセージ数を送る。
export async function GET(req: Request) {
  const cronSecret  = process.env.CRON_SECRET
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!accessToken) {
    return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN が未設定です' }, { status: 503 })
  }

  // サーバーは UTC で動くため JST の「今日」を明示的に計算する
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const [{ data: members }, { data: events }, { data: tasks }, { count: needsReply }] = await Promise.all([
    admin.from('profiles').select('id, full_name, line_user_id')
      .not('line_user_id', 'is', null).eq('is_active', true),
    admin.from('events').select('title, start_time, end_time, assigned_user_id')
      .eq('event_date', today).order('start_time'),
    admin.from('tasks').select('title, due_date, assigned_user_id')
      .lte('due_date', today).neq('status', 'done').order('due_date'),
    admin.from('messages').select('id', { count: 'exact', head: true })
      .eq('needs_reply', true),
  ])

  const dateLabel = `${Number(today.slice(5, 7))}/${Number(today.slice(8, 10))}`
  let sent = 0

  for (const m of members ?? []) {
    const myEvents = (events ?? []).filter(e => e.assigned_user_id === m.id)
    const myTasks  = (tasks ?? []).filter(t => t.assigned_user_id === m.id)

    const lines: string[] = [`おはようございます、${m.full_name}さん（${dateLabel}）`, '']

    lines.push('📅 今日の予定')
    lines.push(myEvents.length
      ? myEvents.map(e => `・${e.start_time.slice(0, 5)} ${e.title}`).join('\n')
      : '・予定はありません')

    lines.push('', '✅ 期限を迎えるタスク')
    lines.push(myTasks.length
      ? myTasks.map(t => `・${t.title}（期限 ${t.due_date}）`).join('\n')
      : '・期限のタスクはありません')

    if ((needsReply ?? 0) > 0) {
      lines.push('', `💬 要返信メッセージが ${needsReply} 件あります`)
    }
    if (appUrl) lines.push('', appUrl)

    try {
      await linePush(m.line_user_id!, [{ type: 'text', text: lines.join('\n') }], accessToken)
      sent++
    } catch (e) {
      console.error(`daily-digest: push failed for ${m.full_name}`, e)
    }
  }

  return NextResponse.json({ ok: true, sent, members: members?.length ?? 0 })
}
