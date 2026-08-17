/**
 * @salud/chatwork — Chatwork API クライアント（Webhook受信専用の最小実装）
 *
 * 環境変数:
 *   CHATWORK_API_TOKEN     — ルームメンバー名取得などAPI呼び出し用（マイページ > API設定で発行）
 *   CHATWORK_WEBHOOK_TOKEN — Webhook作成時に発行される署名検証用トークン
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

const API_BASE = 'https://api.chatwork.com/v2'

export type ChatworkWebhookEvent = {
  from_account_id: number
  to_account_id?: number
  room_id: number
  message_id: string
  body: string
  send_time: number
  update_time: number
}

export type ChatworkWebhookBody = {
  webhook_setting_id: string
  webhook_event_type: string
  webhook_event_time: number
  webhook_event: ChatworkWebhookEvent
}

/** Webhookリクエストの署名（x-chatworkwebhooksignature）を検証する */
export function verifyChatworkSignature(
  rawBody: string,
  signature: string | null,
  webhookToken: string,
): boolean {
  if (!signature) return false
  const key = Buffer.from(webhookToken, 'base64')
  const expected = createHmac('sha256', key).update(rawBody).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** ルームメンバーの表示名を取得する（取得失敗時は null） */
export async function getChatworkRoomMemberName(
  roomId: string,
  accountId: number,
  apiToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/rooms/${roomId}/members`, {
      headers: { 'X-ChatWorkToken': apiToken },
    })
    if (!res.ok) return null
    const members = (await res.json()) as { account_id: number; name: string }[]
    return members.find(m => m.account_id === accountId)?.name ?? null
  } catch {
    return null
  }
}
