/**
 * @salud/google — Google Workspace 連携（将来実装: v2）
 *
 * 実装予定機能:
 * - calendar.ts : Google Calendar 連携
 *     - 面談をカレンダーに自動登録
 *     - カレンダーの予定を面談管理に同期
 * - drive.ts    : Google Drive 連携
 *     - 案件・顧客ごとのフォルダ自動作成
 *     - 書類を Drive にバックアップ
 * - gmail.ts    : Gmail 連携
 *     - 顧客へのメール送受信を管理画面から実行
 *     - メール履歴を案件・顧客に紐づけて保存
 *
 * 環境変数:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI
 *   （.env.example 参照）
 */

export function getGoogleCalendarClient() {
  throw new Error('@salud/google は v2 で実装予定です')
}
