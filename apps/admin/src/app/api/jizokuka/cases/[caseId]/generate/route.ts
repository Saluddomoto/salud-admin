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

  const [{ data: caseRow, error: caseErr }, { data: hearing, error: hearingErr }] = await Promise.all([
    jz.from('cases').select('*').eq('id', params.caseId).single(),
    jz.from('case_hearings').select('*').eq('case_id', params.caseId).single(),
  ])
  if (caseErr || !caseRow) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
  if (hearingErr || !hearing) return NextResponse.json({ error: 'ヒアリング情報が見つかりません' }, { status: 404 })

  try {
    const draft = await generateApplicationDraft({
      businessName: caseRow.business_name,
      representative: caseRow.representative ?? '',
      industry: hearing.industry ?? '',
      employeeCount: hearing.employee_count ?? 0,
      recentRevenue: hearing.recent_revenue ?? 0,
      swotStrength: hearing.swot_strength ?? '',
      swotWeakness: hearing.swot_weakness ?? '',
      swotOpportunity: hearing.swot_opportunity ?? '',
      swotThreat: hearing.swot_threat ?? '',
      marketTrends: hearing.market_trends ?? '',
      customerNeeds: hearing.customer_needs ?? '',
      businessPolicyGoal: hearing.business_policy_goal ?? '',
      futurePlan: hearing.future_plan ?? '',
      subsidyGoal: hearing.subsidy_goal ?? '',
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
