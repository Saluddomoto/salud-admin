import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { regenerateApplicationSection, applicationSectionKeyFromTitle } from '@salud/ai'
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

  try {
    const body = await regenerateApplicationSection(
      buildDraftInput(caseRow, hearing, expenses ?? []),
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
