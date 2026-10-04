import type { ApplicationHearingInput } from '@salud/ai'
import { forecastSales } from './forecast'

type Row = Record<string, unknown>

type Service = { name: string; ratio_pct: number | null; unit_price: number | null }
type Effect = { target: string; offering: string; unit_price: number | null; customers: number | null; frequency: number | null }

// 業務効率化の取組（様式2 補助事業計画の3）を書くかどうか: 機械装置等費・ソフトウェア等の経費がある事業
const EFFICIENCY_PATTERN = /機械装置|ソフトウェア|システム|機器|設備/

/** 案件・ヒアリング・経費明細から、AI下書き生成の入力を組み立てる（生成・再生成で共通） */
export function buildDraftInput(
  caseRow: Row,
  hearing: Row,
  expenses: { category: string | null; description: string | null; amount: unknown }[],
): ApplicationHearingInput {
  const services = (hearing.top_services ?? []) as Service[]
  const effects = (hearing.sales_effects ?? []) as Effect[]
  const growth = hearing.growth_pct as number | null
  const margin = hearing.gross_margin_pct as number | null

  const forecast = forecastSales(effects, margin, growth)
  const recent = Number(hearing.recent_revenue) || 0
  const salesPlan = effects.length
    ? effects.map(e => `${e.target}に「${e.offering}」を単価${e.unit_price ?? '—'}円×客数${e.customers ?? '—'}×月${e.frequency ?? '—'}回`).join('／') +
      `。1年後の売上高見込み約${forecast[0]?.sales.toLocaleString()}円` +
      (growth != null ? `、以降年${growth}%増` : '') +
      (margin != null ? `、粗利率${margin}%` : '')
    : ''
  const schedule = ((hearing.implementation_schedule ?? []) as { task: string; start: string; end: string }[])
    .map(i => `${i.task}：${[i.start, i.end].filter(Boolean).join('〜')}`)
    .join('／')
  const text = (k: string) => (hearing[k] ? String(hearing[k]) : undefined)
  // 売上予想は、ヒアリングシート「3.今後の事業について」の「今後3年間の売上予想」（全社の売上高の予想）を使う
  const salesForecast = recent && effects.length
    ? [`現状${recent.toLocaleString()}円`, ...forecast.map(f =>
        `${f.year}年後${f.sales.toLocaleString()}円（現在比${Math.round((f.sales / recent) * 100)}%）`)].join(' → ')
    : ''

  return {
    businessName: String(caseRow.business_name ?? ''),
    representative: String(caseRow.representative ?? ''),
    industry: String(hearing.industry ?? ''),
    employeeCount: Number(hearing.employee_count) || 0,
    recentRevenue: recent,
    swotStrength: String(hearing.swot_strength ?? ''),
    swotWeakness: String(hearing.swot_weakness ?? ''),
    swotOpportunity: String(hearing.swot_opportunity ?? ''),
    swotThreat: String(hearing.swot_threat ?? ''),
    marketTrends: String(hearing.market_trends || [hearing.swot_opportunity, hearing.swot_threat].filter(Boolean).join('\n')),
    customerNeeds: String(hearing.customer_needs || hearing.customer_segments || ''),
    businessPolicyGoal: String(hearing.business_policy_goal ?? ''),
    futurePlan: String(hearing.future_plan ?? ''),
    subsidyGoal: String(hearing.subsidy_goal ?? ''),
    topServices: services.map((t, i) => `${i + 1}位 ${t.name}（売上比${t.ratio_pct ?? '—'}%・平均単価${t.unit_price ?? '—'}円）`).join('、'),
    customerSegments: String(hearing.customer_segments ?? ''),
    salesPlan,
    salesForecast,
    appealPoints: String(hearing.appeal_points ?? ''),
    expenseSummary: expenses
      .filter(e => e.category || e.description)
      .map(e => `${e.category ?? ''} ${e.description ?? ''}（${Number(e.amount).toLocaleString()}円）`)
      .join('／'),
    schedule,
    efficiencyItems: text('efficiency_items'),
    efficiencyCurrent: text('efficiency_current'),
    efficiencyEffect: text('efficiency_effect'),
    orderChannels: text('order_channels'),
    marketingIssues: text('marketing_issues'),
    paymentTerms: text('payment_terms'),
    expansionPlans: text('expansion_plans'),
    profitTarget: text('profit_target'),
    founderBackground: text('founder_background'),
    companyHistory: text('company_history'),
    marketSources: text('market_sources'),
    customerExamples: text('customer_examples'),
    trackRecord: text('track_record'),
    attachmentsNote: text('attachments_note'),
    includeEfficiency: hearing.efficiency_enabled === false ? false : hearing.efficiency_enabled === true || expenses.some(e => EFFICIENCY_PATTERN.test(`${e.category ?? ''}${e.description ?? ''}`)),
  }
}
