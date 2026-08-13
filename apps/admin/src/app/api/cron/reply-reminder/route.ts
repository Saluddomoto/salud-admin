import { NextResponse } from 'next/server'
import { linePush } from '@salud/line'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REMINDER_THRESHOLD_MS = 2 * 3600_000 // 受信から2時間経っても未返信ならリマインド対象
const BUSINESS_HOUR_START = 9  // JST 9:00 より前は送らない
const BUSINESS_HOUR_END   = 19 // JST 19:00 以降は送らない

// 未返信メッセージのリマインド（Supabase pg_cron から毎時0分に起動、営業時間内のみ送信）。
// 受信トレイの messages を対象に、needs_reply=true のまま2時間以上経過し、
// まだリマインド未送信（reminder_sent_at IS NULL）のものをまとめて通知する。
// 対象は1:1・LINEグループのメッセージ両方（グループはスタッフの発言で needs_reply が
// 解消される＝ apps/admin/src/app/api/line/webhook/route.ts 側の処理）。
// 宛先は毎朝のダイジェストと同じ（line_user_id 登録済み・稼働中・digest_enabled）。
export async function GET(req: Request) {
  const cronSecret  = process.env.CRON_SECRET
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!accessToken) {
    return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN が未設定です' }, { status: 503 })
  }

  // サーバーは UTC で動くため JST の「今の時刻」を明示的に計算する
  const jstHour = Number(new Date(Date.now() + 9 * 3600_000).toISOString().slice(11, 13))
  if (jstHour < BUSINESS_HOUR_START || jstHour >= BUSINESS_HOUR_END) {
    return NextResponse.json({ ok: true, skipped: 'outside business hours' })
  }

  const admin = createAdminClient()
  const threshold = new Date(Date.now() - REMINDER_THRESHOLD_MS).toISOString()

  const { data: pending, error: pendingError } = await admin
    .from('messages')
    .select('id, sender_name, company_name, body, received_at')
    .eq('needs_reply', true)
    .is('dismissed_at', null)
    .is('reminder_sent_at', null)
    .lte('received_at', threshold)
    .order('received_at')

  if (pendingError) {
    console.error('reply-reminder: fetch failed', pendingError)
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, pending: 0 })
  }

  const { data: members } = await admin
    .from('profiles')
    .select('id, full_name, line_user_id')
    .not('line_user_id', 'is', null)
    .eq('is_active', true)
    .eq('digest_enabled', true)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const lines: string[] = [`⚠️ 返信できていないメッセージが ${pending.length} 件あります（受信から2時間以上経過）`, '']
  lines.push(...pending.slice(0, 10).map(m => {
    const who = m.company_name ? `${m.company_name} / ${m.sender_name}` : m.sender_name
    const snippet = m.body.length > 30 ? `${m.body.slice(0, 30)}…` : m.body
    return `・${who}「${snippet}」`
  }))
  if (pending.length > 10) lines.push(`他 ${pending.length - 10} 件`)
  if (appUrl) lines.push('', appUrl)

  let sent = 0
  for (const m of members ?? []) {
    try {
      await linePush(m.line_user_id!, [{ type: 'text', text: lines.join('\n') }], accessToken)
      sent++
    } catch (e) {
      console.error(`reply-reminder: push failed for ${m.full_name}`, e)
    }
  }

  const { error: updateError } = await admin.from('messages')
    .update({ reminder_sent_at: new Date().toISOString() })
    .in('id', pending.map(m => m.id))
  if (updateError) console.error('reply-reminder: reminder_sent_at update failed', updateError)

  return NextResponse.json({ ok: true, sent, pending: pending.length })
}
