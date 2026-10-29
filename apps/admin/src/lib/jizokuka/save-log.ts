import { createClient } from '@/lib/supabase'

// 保存ログ: 誰が・いつ・どこから・どの項目を保存したかを残す（内容そのものは記録しない）。
// ログの記録に失敗しても、保存自体は失敗させない。

const LABELS: Record<string, string> = {
  industry: '業種', employee_count: '従業員数', recent_revenue: '直近売上', past_financials: '決算実績（3期分）', top_services: '主力商品・サービス',
  customer_segments: '顧客層', swot_strength: '強み', swot_weakness: '弱み', swot_opportunity: '機会', swot_threat: '脅威',
  subsidy_goal: '補助事業で目指すこと', sales_effects: '売上の見込み', gross_margin_pct: '粗利率', growth_pct: '売上伸び率',
  appeal_points: 'アピールポイント', market_trends: '市場の動向', business_policy_goal: '経営方針・目標', future_plan: '今後のプラン',
  implementation_schedule: '実施スケジュール', efficiency_enabled: '業務効率化の有無', efficiency_items: '業務効率化の内容',
  efficiency_current: '業務効率化の現状', efficiency_effect: '業務効率化の効果', order_channels: '受注・集客経路',
  marketing_issues: '販促上の課題', payment_terms: '支払条件', expansion_plans: '今後の展開', profit_target: '利益目標',
  founder_background: '創業の経緯・代表者経歴', company_history: '沿革', market_sources: '市場データの出典',
  customer_examples: '顧客・取引先の例', track_record: '実績', attachments_note: '添付資料メモ', target_sales_y1: '1年後の売上目標',
  target_sales_y3: '3年後の売上目標', target_sales_basis: '売上目標の根拠',
  website_url: 'ホームページURL', company_phone: '会社電話番号', contact_email: '担当者メール', contact_mobile: '担当者携帯',
  representative_birthdate: '代表者生年月日', postal_code: '郵便番号', industry_category: '業種区分',
  past_adoption_summary: '過去の採択実績', policy_points: '政策加点',
}

export const fieldLabel = (key: string) => LABELS[key] ?? key

/** 概算料金の為替レート（円/ドル）。サーバー側の ai-usage.ts と同じ値 */
export const JPY_PER_USD = 150

export interface AiUsageEntry {
  id: string
  operation: string
  calls: number
  input_tokens: number
  output_tokens: number
  web_searches: number
  cost_usd: number
  created_at: string
}

export async function fetchAiUsage(caseId: string): Promise<AiUsageEntry[]> {
  const { data, error } = await createClient().schema('jizokuka').from('case_ai_usage')
    .select('id, operation, calls, input_tokens, output_tokens, web_searches, cost_usd, created_at')
    .eq('case_id', caseId).order('created_at', { ascending: false }).limit(100)
  if (error) throw new Error(error.message)
  return ((data ?? []) as AiUsageEntry[]).map(r => ({ ...r, cost_usd: Number(r.cost_usd) }))
}

/** AI処理の応答ヘッダーにある今回の概算費用（円）を、画面へ知らせる（保存ログ欄が表示する） */
export function announceAiCost(res: Response, operation: string): void {
  const yen = res.headers.get('X-AI-Cost-Yen')
  if (yen == null || typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('jizokuka-ai-cost', { detail: { operation, yen: Number(yen) } }))
}

export const formatYen = (yen: number) => (yen < 1 ? `約${yen.toFixed(2)}円` : `約${yen.toFixed(1)}円`)

export interface SaveLogEntry {
  id: string
  case_id: string
  source: string
  summary: string
  actor: string | null
  created_at: string
}

/** 保存ログを1件記録する（失敗しても例外は出さない） */
export async function logSave(caseId: string, source: string, keysOrSummary: string[] | string): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const summary = Array.isArray(keysOrSummary) ? keysOrSummary.map(fieldLabel).join('、') : keysOrSummary
    await supabase.schema('jizokuka').from('case_save_log').insert({
      case_id: caseId, source, summary, actor: user?.email ?? null,
    })
  } catch {
    // ログ記録の失敗は無視する
  }
}

export async function fetchSaveLog(caseId: string, limit = 100): Promise<SaveLogEntry[]> {
  const { data, error } = await createClient().schema('jizokuka').from('case_save_log')
    .select('*').eq('case_id', caseId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as SaveLogEntry[]
}
