import { NextResponse } from 'next/server'
import { getLineProfile, lineReply, verifyLineSignature, type LineWebhookBody } from '@salud/line'
import { createAdminClient } from '@/lib/supabase-admin'
import { parseEventMessage } from '@/lib/line-event-parser'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const USAGE_REPLY = [
  '予定として登録できませんでした🙏',
  '日付と時刻を入れて送ってください。例:',
  '',
  '予定 7/10 14:00 山田製作所 打ち合わせ',
  '予定 7/10 14:00-15:30 テックス商談',
].join('\n')

// LINE 公式アカウントへのメッセージを処理する。
// - 社内メンバー（profiles.line_user_id 登録者）から → 予定として解析しスケジュールに登録
// - それ以外（顧客・未登録） → 受信トレイ（messages）に「要返信」で取り込む
// LINE Developers コンソールで Webhook URL に https://<host>/api/line/webhook を設定する。
export async function POST(req: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  const accessToken   = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!channelSecret || !accessToken) {
    return NextResponse.json({ error: 'LINE 環境変数が未設定です' }, { status: 503 })
  }

  const rawBody = await req.text()
  if (!verifyLineSignature(rawBody, req.headers.get('x-line-signature'), channelSecret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as LineWebhookBody
  const admin = createAdminClient()

  for (const event of body.events ?? []) {
    if (event.type !== 'message' || !event.message) continue

    const text = event.message.type === 'text'
      ? (event.message.text ?? '')
      : `（${event.message.type} メッセージを受信しました。LINE アプリで確認してください）`

    const userId = event.source?.userId ?? null
    let senderName = 'LINE ユーザー'
    let companyName: string | null = null

    // 社内メンバーからのメッセージ → 予定登録コマンドとして処理（受信トレイには入れない）
    if (userId) {
      const { data: staff } = await admin
        .from('profiles')
        .select('id, full_name')
        .eq('line_user_id', userId)
        .maybeSingle()

      if (staff) {
        let reply = USAGE_REPLY
        const parsed = event.message.type === 'text' ? parseEventMessage(text) : null
        if (parsed) {
          const { error } = await admin.from('events').insert({
            ...parsed,
            assigned_user_id: staff.id,
            created_by:       staff.id,
            notes:            'LINE から登録',
          })
          reply = error
            ? '登録に失敗しました。時間をおいて再度お試しください🙏'
            : [
                '予定を登録しました✅',
                `📅 ${parsed.event_date.slice(5).replace('-', '/')} ${parsed.start_time}–${parsed.end_time}`,
                `📝 ${parsed.title}（担当: ${staff.full_name}）`,
                '明朝のダイジェストで全員に共有されます。',
              ].join('\n')
          if (error) console.error('LINE webhook: event insert failed', error)
        }
        if (event.replyToken) {
          await lineReply(event.replyToken, [{ type: 'text', text: reply }], accessToken)
            .catch(e => console.error('LINE webhook: reply failed', e))
        }
        continue
      }
    }

    if (userId) {
      // 顧客マスタに line_user_id が登録されていれば社名・担当者名を紐づける
      const { data: customer } = await admin
        .from('customers')
        .select('company_name, customer_contacts(name, is_primary)')
        .eq('line_user_id', userId)
        .maybeSingle()

      if (customer) {
        companyName = customer.company_name
        const contacts = customer.customer_contacts as { name: string; is_primary: boolean }[] | null
        senderName = contacts?.find(c => c.is_primary)?.name ?? senderName
      }

      if (senderName === 'LINE ユーザー') {
        const profile = await getLineProfile(userId, accessToken)
        if (profile) senderName = profile.displayName
      }
    }

    const { error } = await admin.from('messages').insert({
      channel:      'line',
      sender_name:  senderName,
      company_name: companyName,
      body:         text,
      line_user_id: userId,
      needs_reply:  true,
      received_at:  event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
    })
    if (error) console.error('LINE webhook: insert failed', error)
  }

  return NextResponse.json({ ok: true })
}
