/**
 * @salud/line — LINE Messaging API クライアント
 *
 * 環境変数（.env.example 参照）:
 *   LINE_CHANNEL_SECRET       — Webhook 署名検証用
 *   LINE_CHANNEL_ACCESS_TOKEN — Push / Reply / Profile 取得用
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

const API_BASE = 'https://api.line.me/v2/bot'

export type LineTextMessage = { type: 'text'; text: string }

export type LineWebhookEvent = {
  type: string
  replyToken?: string
  source?: { type: 'user' | 'group' | 'room'; userId?: string }
  message?: { id: string; type: string; text?: string }
  timestamp?: number
}

export type LineWebhookBody = { destination?: string; events: LineWebhookEvent[] }

/** Webhook リクエストの署名（x-line-signature）を検証する */
export function verifyLineSignature(
  rawBody: string,
  signature: string | null,
  channelSecret: string,
): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', channelSecret).update(rawBody).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function callLineApi(path: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LINE API ${path} failed: ${res.status} ${detail}`)
  }
  return res
}

/** 任意のユーザーへメッセージを送信する（Push） */
export async function linePush(
  to: string,
  messages: LineTextMessage[],
  accessToken: string,
): Promise<void> {
  await callLineApi('/message/push', accessToken, {
    method: 'POST',
    body: JSON.stringify({ to, messages }),
  })
}

/** 受信イベントへの返信（Reply — replyToken の有効期限は約1分） */
export async function lineReply(
  replyToken: string,
  messages: LineTextMessage[],
  accessToken: string,
): Promise<void> {
  await callLineApi('/message/reply', accessToken, {
    method: 'POST',
    body: JSON.stringify({ replyToken, messages }),
  })
}

/** ユーザーのプロフィール（表示名）を取得する。友だち登録がないと null */
export async function getLineProfile(
  userId: string,
  accessToken: string,
): Promise<{ displayName: string; pictureUrl?: string } | null> {
  try {
    const res = await callLineApi(`/profile/${userId}`, accessToken)
    return (await res.json()) as { displayName: string; pictureUrl?: string }
  } catch {
    return null
  }
}
