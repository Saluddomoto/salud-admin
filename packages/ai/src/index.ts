/**
 * @salud/ai — AI エージェント機能
 *
 * 使用モデル: Claude API (Anthropic)
 * 環境変数: ANTHROPIC_API_KEY（.env.example 参照）
 *
 * 実装済み:
 * - minutes.ts   : 議事録分析（要約・決定事項・アクションアイテム抽出）
 * - monthly-report-summary.ts : 役員月報の横断AI分析（複数人の月報をまとめて要約・課題・議論アジェンダ・アドバイスを生成）
 * - application.ts : AI申請書生成（持続化パイロット — 小規模事業者持続化補助金の申請書下書き作成）
 * - evaluation.ts : AI審査基準チェック（持続化パイロット — 下書きが審査の観点をどの程度満たすかを判定）
 *
 * 実装予定機能（v4）:
 * - email.ts     : AIメール生成（顧客向けメール文章の自動生成）
 * - chat.ts      : AIチャット（社内ナレッジベースに基づく Q&A）
 * - summary.ts   : 案件・顧客サマリー自動生成
 */

export { analyzeMeetingMinutes, type MeetingAnalysis } from './minutes'
export { classifyLineMessageForTask, type LineTaskCandidate } from './line-task'
export { summarizeMonthlyReports, type MonthlyReportPerson, type MonthlyReportSummary } from './monthly-report-summary'
export { summarizeAnnualReports, type AnnualReportPerson, type AnnualReportSummary } from './annual-report-summary'
export {
  generateApplicationDraft,
  regenerateApplicationSection,
  APPLICATION_SECTION_LABELS,
  APPLICATION_SECTION_ORDER,
  type ApplicationHearingInput,
  type ApplicationDraft,
} from './application'
export {
  evaluateApplicationDraft,
  EVALUATION_CRITERIA_LABELS,
  type ApplicationEvaluation,
  type EvaluationCriterionResult,
} from './evaluation'
