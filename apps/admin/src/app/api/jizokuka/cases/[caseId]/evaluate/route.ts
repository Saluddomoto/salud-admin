import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { evaluateApplicationDraft } from '@salud/ai'
import { splitSectionTitle } from '@/lib/jizokuka/sections'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatYen(n: number) {
  return `${Math.round(n).toLocaleString('ja-JP')}円`
}

// 持続化パイロット: 下書き済みの申請文章を、審査の4観点に照らしてAIにチェックさせる。
export async function POST(_req: Request, { params }: { params: { caseId: string } }) {
  const supabase = createServerSupabaseClient()
  const jz = supabase.schema('jizokuka')

  const [{ data: sections, error: sectionsErr }, { data: items, error: itemsErr }, { data: caseRow, error: caseErr }] =
    await Promise.all([
      jz.from('case_draft_sections').select('*').eq('case_id', params.caseId).order('sort_order'),
      jz.from('case_expense_items').select('*').eq('case_id', params.caseId),
      jz.from('cases').select('*').eq('id', params.caseId).single(),
    ])
  if (sectionsErr) return NextResponse.json({ error: sectionsErr.message }, { status: 500 })
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  if (caseErr || !caseRow) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
  if (!sections || sections.length === 0) {
    return NextResponse.json({ error: '下書きがまだ生成されていません' }, { status: 400 })
  }

  const draftText = sections
    .map(s => `【${splitSectionTitle(s.title).label}】\n${s.body}`)
    .join('\n\n')

  const expenseItems = items ?? []
  const total = expenseItems.reduce((sum, i) => sum + (i.amount || 0), 0)
  const rate = caseRow.subsidy_rate ?? 0.6667
  const estimatedGrant = Math.min(Math.floor(total * rate), caseRow.subsidy_cap ?? 500000)
  const expenseSummary = expenseItems.length === 0
    ? ''
    : `経費件数: ${expenseItems.length}件、経費合計: ${formatYen(total)}、` +
      `補助率: ${rate}、想定交付申請額（概算）: ${formatYen(estimatedGrant)}\n` +
      expenseItems.map(i => `- ${i.category ?? '（未選択）'}: ${i.description ?? ''}（${formatYen(i.amount || 0)}）`).join('\n')

  try {
    const evaluation = await evaluateApplicationDraft(draftText, expenseSummary)
    return NextResponse.json(evaluation)
  } catch (e) {
    console.error('持続化パイロット: 審査基準チェックに失敗', e)
    return NextResponse.json({ error: '審査基準のチェックに失敗しました' }, { status: 500 })
  }
}
