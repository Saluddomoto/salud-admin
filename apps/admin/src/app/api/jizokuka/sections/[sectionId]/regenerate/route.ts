import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { regenerateApplicationSection, applicationSectionKeyFromTitle, sanitizeCitations, extractUrls } from '@salud/ai'
import { buildDraftInput } from '@/lib/jizokuka/draft-input'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  const [{ data: caseRow, error: caseErr }, { data: hearing, error: hearingErr }, { data: expenses }] = await Promise.all([
    jz.from('cases').select('*').eq('id', section.case_id).single(),
    jz.from('case_hearings').select('*').eq('case_id', section.case_id).single(),
    jz.from('case_expense_items').select('category, description, amount').eq('case_id', section.case_id).order('sort_order'),
  ])
  if (caseErr || !caseRow || hearingErr || !hearing) {
    return NextResponse.json({ error: '案件情報の取得に失敗しました' }, { status: 404 })
  }

  const sectionKey = applicationSectionKeyFromTitle(section.title) ?? 'overview'

  const input = buildDraftInput(caseRow, hearing, expenses ?? [])
  // 市場の動向の再生成では、現在の本文にある出典（生成時に検証済み）を維持して使えるようにする
  if (sectionKey === 'marketTrends') {
    input.researchedSources = `（現在の本文にある出典はすべて検証済みなので維持してよい。新しい出典は追加しない）
${section.body}`
  }

  try {
    const body = await regenerateApplicationSection(
      input,
      sectionKey,
      section.body,
      instruction,
    )

    // 市場の動向は、再生成でも元の本文にある（検証済みの）出典URLしか使わせない
    const finalBody = sectionKey === 'marketTrends' ? sanitizeCitations(body, extractUrls(section.body)) : body

    await jz.from('case_draft_sections').update({ body: finalBody, updated_at: new Date().toISOString() }).eq('id', params.sectionId)

    return NextResponse.json({ ok: true, body: finalBody })
  } catch (e) {
    console.error('持続化パイロット: セクション再生成に失敗', e)
    return NextResponse.json({ error: 'AI再生成に失敗しました' }, { status: 500 })
  }
}
