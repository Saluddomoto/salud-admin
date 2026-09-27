import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { regenerateApplicationSection, APPLICATION_SECTION_LABELS, type ApplicationDraft } from '@salud/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LABEL_TO_KEY = Object.fromEntries(
  (Object.entries(APPLICATION_SECTION_LABELS) as [keyof ApplicationDraft, string][]).map(([key, label]) => [label, key]),
) as Record<string, keyof ApplicationDraft>

// 持続化パイロット: 担当者の追加指示を反映して1セクションだけ再生成する。
export async function POST(req: Request, { params }: { params: { sectionId: string } }) {
  const { instruction } = (await req.json().catch(() => ({}))) as { instruction?: string }
  if (!instruction?.trim()) {
    return NextResponse.json({ error: '修正指示を入力してください' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const jz = supabase.schema('jizokuka')

  const { data: section, error: sectionErr } = await jz
    .from('case_draft_sections').select('*').eq('id', params.sectionId).single()
  if (sectionErr || !section) return NextResponse.json({ error: 'セクションが見つかりません' }, { status: 404 })

  const [{ data: caseRow, error: caseErr }, { data: hearing, error: hearingErr }] = await Promise.all([
    jz.from('cases').select('*').eq('id', section.case_id).single(),
    jz.from('case_hearings').select('*').eq('case_id', section.case_id).single(),
  ])
  if (caseErr || !caseRow || hearingErr || !hearing) {
    return NextResponse.json({ error: '案件情報の取得に失敗しました' }, { status: 404 })
  }

  const sectionKey = LABEL_TO_KEY[section.title] ?? 'overview'

  try {
    const body = await regenerateApplicationSection(
      {
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
      },
      sectionKey,
      section.body,
      instruction,
    )

    await jz.from('case_draft_sections').update({ body, updated_at: new Date().toISOString() }).eq('id', params.sectionId)

    return NextResponse.json({ ok: true, body })
  } catch (e) {
    console.error('持続化パイロット: セクション再生成に失敗', e)
    return NextResponse.json({ error: 'AI再生成に失敗しました' }, { status: 500 })
  }
}
