/**
 * @salud/notifications — 通知基盤（将来実装: v3）
 *
 * 複数チャネルへの通知を統一インターフェースで送信する
 *
 * チャネル:
 * - channels/line.ts  : LINE メッセージ通知
 * - channels/email.ts : メール通知（Firebase Cloud Functions 経由）
 * - channels/push.ts  : ブラウザ プッシュ通知（PWA 対応後）
 *
 * 通知トリガー（Firebase Cloud Functions で実装予定）:
 * - 申請期限14日前: 担当者に LINE + メール
 * - 案件ステータス変更: 担当者全員に通知
 * - タスク期限当日: 担当者に LINE
 * - 新規アサイン: 対象者に通知
 */

export function sendNotification() {
  throw new Error('@salud/notifications は v3 で実装予定です')
}
