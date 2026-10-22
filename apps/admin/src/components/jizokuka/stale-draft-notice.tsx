'use client'

import { useState } from 'react'
import { generateInitialDraft } from '@/lib/jizokuka/db'

// ヒアリング（メモ反映を含む）が下書き生成のあとに更新されていたら知らせ、最新のヒアリングで下書きを作り直せるようにする。
export function StaleDraftNotice({ caseId, hearingUpdatedAt, draftGeneratedAt }: {
  caseId: string
  hearingUpdatedAt: string | null | undefined
  draftGeneratedAt: string | null | undefined
}) {
  const [busy, setBusy] = useState(false)
  if (!hearingUpdatedAt || !draftGeneratedAt) return null
  if (new Date(hearingUpdatedAt).getTime() <= new Date(draftGeneratedAt).getTime()) return null

  const regenerate = async () => {
    if (!window.confirm('最新のヒアリング内容で、下書き全体を作り直します。\n下書きを手で直している場合、その修正は消えます（必要なら先に控えを取ってください）。\n\n作り直しますか？')) return
    setBusy(true)
    try {
      await generateInitialDraft(caseId)
      window.location.reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : '下書きの作り直しに失敗しました')
      setBusy(false)
    }
  }

  return (
    <div className="card flex flex-col gap-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <p>
        ヒアリングの内容が、下書きを作ったあとに更新されています（ヒアリング更新: {new Date(hearingUpdatedAt).toLocaleString('ja-JP')} ／ 下書き作成: {new Date(draftGeneratedAt).toLocaleString('ja-JP')}）。この画面の文章には、まだ反映されていません。
      </p>
      <button type="button" className="btn-primary shrink-0" disabled={busy} onClick={regenerate}>
        {busy ? 'AIが作り直し中…' : '最新のヒアリングで下書きを作り直す'}
      </button>
    </div>
  )
}
