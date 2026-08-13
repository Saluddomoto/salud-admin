/**
 * @salud/ai — AI エージェント機能
 *
 * 使用モデル: Claude API (Anthropic)
 * 環境変数: ANTHROPIC_API_KEY（.env.example 参照）
 *
 * 実装済み:
 * - minutes.ts   : 議事録分析（要約・決定事項・アクションアイテム抽出）
 *
 * 実装予定機能（v4）:
 * - email.ts     : AIメール生成（顧客向けメール文章の自動生成）
 * - application.ts : AI申請書生成（補助金申請書の下書き作成）
 * - chat.ts      : AIチャット（社内ナレッジベースに基づく Q&A）
 * - summary.ts   : 案件・顧客サマリー自動生成
 */

export { analyzeMeetingMinutes, type MeetingAnalysis } from './minutes'
export { classifyLineMessageForTask, type LineTaskCandidate } from './line-task'
