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
  // 補助事業による増収分が現状売上に上乗せされる前提で、現状→1〜3年後を並べる（現在比%も付ける）
  const salesForecast = recent && effects.length
    ? [`現状${recent.toLocaleString()}円`, ...forecast.map(f => {
        const total = recent + f.sales
        return `${f.year}年後${total.toLocaleString()}円（現在比${Math.round((total / recent) * 100)}%）`
      })].join(' → ')
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
    includeEfficiency: expenses.some(e => EFFICIENCY_PATTERN.test(`${e.category ?? ''}${e.description ?? ''}`)),
  }
}
