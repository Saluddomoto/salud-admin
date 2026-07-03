/**
 * @salud/line — LINE 連携（将来実装: v3）
 *
 * 実装予定機能:
 * - messaging.ts : LINE Messaging API
 *     - 案件ステータス変更通知
 *     - 申請期限14日前アラート（担当者に自動送信）
 *     - タスク期限通知
 * - login.ts     : LINE Login（顧客ポータルでの認証）
 * - webhook.ts   : LINE Webhook ハンドラー（受信メッセージ処理）
 *
 * 環境変数:
 *   LINE_CHANNEL_ID
 *   LINE_CHANNEL_SECRET
 *   LINE_CHANNEL_ACCESS_TOKEN
 *   （.env.example 参照）
 */

export function sendLineMessage() {
  throw new Error('@salud/line は v3 で実装予定です')
}
