import { NextResponse } from 'next/server'
import { getLineProfile, verifyLineSignature, type LineWebhookBody } from '@salud/line'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// LINE 公式アカウントへのメッセージを受信トレイ（messages）に取り込む。
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
