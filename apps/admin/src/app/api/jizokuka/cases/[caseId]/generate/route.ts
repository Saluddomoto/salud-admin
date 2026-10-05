import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  generateApplicationDraft, APPLICATION_SECTION_LABELS, APPLICATION_SECTION_ORDER,
  researchMarketSources, formatMarketSources, sanitizeCitations,
} from '@salud/ai'
import { buildDraftInput } from '@/lib/jizokuka/draft-input'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// セクション数が多く、生成に時間がかかるため
export const maxDuration = 300

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

  try {
    const input = buildDraftInput(caseRow, hearing, expenses ?? [])

    // 「2-1 市場の動向」の根拠: 政府サイトで検索した統計（公表から2年以内）。検索に失敗しても下書き生成は続ける
    let sources: Awaited<ReturnType<typeof researchMarketSources>> = []
    try {
      sources = await researchMarketSources({
        businessName: input.businessName,
        industry: input.industry,
        topServices: input.topServices,
        customerSegments: input.customerSegments,
        marketTrends: input.marketTrends,
      })
    } catch (e) {
      console.error('持続化パイロット: 政府統計の検索に失敗（出典なしで生成を続行）', e)
    }
    input.researchedSources = formatMarketSources(sources)

    const draft = await generateApplicationDraft(input)
    // 検証済みでないURLが本文に混ざっていたら「【要確認：出典】」に置き換える
    if (draft.marketTrends) draft.marketTrends = sanitizeCitations(draft.marketTrends, sources.map(s => s.url))

    const rows = APPLICATION_SECTION_ORDER
      .filter(key => draft[key] !== undefined)
      .map((key, i) => ({
        case_id: params.caseId,
        title: APPLICATION_SECTION_LABELS[key],
        body: draft[key] ?? '',
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
