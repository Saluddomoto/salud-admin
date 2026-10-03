import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateApplicationDraft, APPLICATION_SECTION_LABELS, APPLICATION_SECTION_ORDER } from '@salud/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 持続化パイロット: ヒアリング内容から全セクションの初稿を一括生成する。
// ANTHROPIC_API_KEY を使うため（ブラウザに露出させたくない）API route 側で実行する。
export async function POST(_req: Request, { params }: { params: { caseId: string } }) {
  const supabase = createServerSupabaseClient()
  const jz = supabase.schema('jizokuka')

  const [{ data: caseRow, error: caseErr }, { data: hearing, error: hearingErr }, { data: expenses }] = await Promise.all([
    jz.from('cases').select('*').eq('id', params.caseId).single(),
    jz.from('case_hearings').select('*').eq('case_id', params.caseId).single(),
    jz.from('case_expense_items').select('category, description, amount').eq('case_id', params.caseId).order('sort_order'),
  ])
  if (caseErr || !caseRow) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
  if (hearingErr || !hearing) return NextResponse.json({ error: 'ヒアリング情報が見つかりません' }, { status: 404 })

  type Service = { name: string; ratio_pct: number | null; unit_price: number | null }
  type Effect = { target: string; offering: string; unit_price: number | null; customers: number | null; frequency: number | null }
  const topServices = ((hearing.top_services ?? []) as Service[])
    .map((t, i) => `${i + 1}位 ${t.name}（売上比${t.ratio_pct ?? '—'}%・平均単価${t.unit_price ?? '—'}円）`)
    .join('、')
  const effects = (hearing.sales_effects ?? []) as Effect[]
  const year1 = effects.reduce((sum, e) => sum + (e.unit_price ?? 0) * (e.customers ?? 0) * (e.frequency ?? 0), 0) * 12
  const salesPlan = effects.length
    ? effects.map(e => `${e.target}に「${e.offering}」を単価${e.unit_price ?? '—'}円×客数${e.customers ?? '—'}×月${e.frequency ?? '—'}回`).join('／') +
      `。1年後の売上高見込み約${year1.toLocaleString()}円` +
      (hearing.growth_pct != null ? `、以降年${hearing.growth_pct}%増` : '') +
      (hearing.gross_margin_pct != null ? `、粗利率${hearing.gross_margin_pct}%` : '')
    : ''
  const expenseSummary = (expenses ?? [])
    .filter(e => e.category || e.description)
    .map(e => `${e.category ?? ''} ${e.description ?? ''}（${Number(e.amount).toLocaleString()}円）`)
    .join('／')

  try {
    const draft = await generateApplicationDraft({
      businessName: caseRow.business_name,
      representative: caseRow.representative ?? '',
      industry: hearing.industry ?? '',
      employeeCount: hearing.employee_count ?? 0,
      recentRevenue: Number(hearing.recent_revenue) || 0,
      swotStrength: hearing.swot_strength ?? '',
      swotWeakness: hearing.swot_weakness ?? '',
      swotOpportunity: hearing.swot_opportunity ?? '',
      swotThreat: hearing.swot_threat ?? '',
      marketTrends: hearing.market_trends || [hearing.swot_opportunity, hearing.swot_threat].filter(Boolean).join('\n'),
      customerNeeds: hearing.customer_needs || hearing.customer_segments || '',
      businessPolicyGoal: hearing.business_policy_goal ?? '',
      futurePlan: hearing.future_plan ?? '',
      subsidyGoal: hearing.subsidy_goal ?? '',
      topServices,
      customerSegments: hearing.customer_segments ?? '',
      salesPlan,
      appealPoints: hearing.appeal_points ?? '',
      expenseSummary,
    })

    const rows = APPLICATION_SECTION_ORDER.map((key, i) => ({
      case_id: params.caseId,
      title: APPLICATION_SECTION_LABELS[key],
      body: draft[key],
      sort_order: i,
    }))

    await jz.from('case_draft_sections').delete().eq('case_id', params.caseId)
    const { error: insertErr } = await jz.from('case_draft_sections').insert(rows)
    if (insertErr) throw insertErr

    await jz.from('cases').update({ status: 'review', updated_at: new Date().toISOString() }).eq('id', params.caseId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('持続化パイロット: 下書き生成に失敗', e)
    return NextResponse.json({ error: 'AI下書きの生成に失敗しました' }, { status: 500 })
  }
}
