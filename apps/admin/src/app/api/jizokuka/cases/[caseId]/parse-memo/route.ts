import { NextResponse } from 'next/server'
import { runTracked } from '@/lib/jizokuka/ai-usage'
import { sortHearingMemo } from '@salud/ai'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { maskPii, unmask } from '@/lib/jizokuka/pii-mask'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 持続化パイロット: ヒアリング時の自由記述メモを入力項目ごとに振り分けた提案を返す（保存はしない）。
// 個人情報（電話・メール・生年月日・郵便番号・マイナンバー・口座・登録済みの氏名）は、AIへ送る前に記号へ置き換え、
// 結果を返すときに元へ戻す。マイナンバー・口座は復元せず、保存対象にもしない。
async function handle(req: Request, { params }: { params: { caseId: string } }) {
  const { memo } = (await req.json().catch(() => ({}))) as { memo?: string }
  if (!memo?.trim()) return NextResponse.json({ error: 'メモを入力してください' }, { status: 400 })
  if (memo.length > 30000) return NextResponse.json({ error: 'メモが長すぎます（3万字以内）' }, { status: 400 })

  const { data: caseRow } = await createServerSupabaseClient()
    .schema('jizokuka').from('cases').select('business_name, representative').eq('id', params.caseId).single()
  const names = [caseRow?.business_name, caseRow?.representative].filter((x): x is string => !!x)

  const { masked, tokens, direct } = maskPii(memo, names)
  try {
    const { proposals, unmatched } = await sortHearingMemo(masked)
    const restored = proposals.map(p => ({ ...p, value: unmask(p.value, tokens) }))
    // 直接振り分けた項目と同じキーのAI提案は、プログラム抽出の値を優先する
    const directKeys = new Set(direct.map(d => d.key))
    return NextResponse.json({
      proposals: [...restored.filter(p => !directKeys.has(p.key)), ...direct],
      unmatched: unmask(unmatched, tokens),
      maskedCount: tokens.size,
    })
  } catch (e) {
    console.error('持続化パイロット: メモの振り分けに失敗', e)
    return NextResponse.json({ error: 'AIによる振り分けに失敗しました' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  return runTracked('メモ振り分け', async () => params.caseId, () => handle(req, { params }))
}
