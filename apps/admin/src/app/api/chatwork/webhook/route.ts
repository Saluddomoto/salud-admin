import { NextResponse } from 'next/server'
import {
  verifyChatworkSignature, getChatworkRoomMemberName, type ChatworkWebhookBody,
} from '@salud/chatwork'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Chatworkのルームでのメッセージを受信トレイ(messages)に取り込む。
// 対象は customers.chatwork_room_id に登録済みのルームのみ（未登録ルームは無視）。
// - 登録済みスタッフ（profiles.chatwork_account_id）の発言 → そのルームの未返信を解消扱いにする
//   （LINEグループの「スタッフが発言したら未返信解消」と同じ考え方）
// - それ以外（クライアント）の発言 → 受信トレイに「要返信」で追加
//   （未返信のままなら既存の cron/reply-reminder が公式LINEでスタッフに通知する）
// Chatwork の Webhook 作成時（POST /v2/webhooks）に URL へ
// https://<host>/api/chatwork/webhook を設定する。
export async function POST(req: Request) {
  const apiToken     = process.env.CHATWORK_API_TOKEN
  const webhookToken = process.env.CHATWORK_WEBHOOK_TOKEN
  if (!apiToken || !webhookToken) {
    return NextResponse.json({ error: 'Chatwork 環境変数が未設定です' }, { status: 503 })
  }

  const rawBody = await req.text()
  if (!verifyChatworkSignature(rawBody, req.headers.get('x-chatworkwebhooksignature'), webhookToken)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as ChatworkWebhookBody
  if (body.webhook_event_type !== 'message_created') {
    return NextResponse.json({ ok: true, skipped: 'unsupported event type' })
  }

  const event  = body.webhook_event
  const roomId = String(event.room_id)
  const admin  = createAdminClient()

  const { data: customer } = await admin
    .from('customers')
    .select('company_name, customer_contacts(name, is_primary)')
    .eq('chatwork_room_id', roomId)
    .maybeSingle()
  if (!customer) {
    return NextResponse.json({ ok: true, skipped: 'unregistered room' })
  }

  const { data: staff } = await admin
    .from('profiles')
    .select('id')
    .eq('chatwork_account_id', String(event.from_account_id))
    .maybeSingle()

  if (staff) {
    // 社内メンバーがこのルームで発言した = 未返信を解消扱いにする
    const { error } = await admin.from('messages')
      .update({ needs_reply: false })
      .eq('chatwork_room_id', roomId)
      .eq('needs_reply', true)
    if (error) console.error('Chatwork webhook: reply-clear failed', error)
    return NextResponse.json({ ok: true, resolved: true })
  }

  const contacts = customer.customer_contacts as { name: string; is_primary: boolean }[] | null
  const memberName = await getChatworkRoomMemberName(roomId, event.from_account_id, apiToken)
  const senderName = memberName ?? contacts?.find(c => c.is_primary)?.name ?? customer.company_name

  const { error } = await admin.from('messages').insert({
    channel:             'chatwork',
    sender_name:         senderName,
    company_name:        customer.company_name,
    body:                event.body,
    chatwork_room_id:    roomId,
    chatwork_account_id: String(event.from_account_id),
    source_type:         'room',
    needs_reply:         true,
    received_at:         new Date(event.send_time * 1000).toISOString(),
  })
  if (error) console.error('Chatwork webhook: insert failed', error)

  return NextResponse.json({ ok: true })
}
