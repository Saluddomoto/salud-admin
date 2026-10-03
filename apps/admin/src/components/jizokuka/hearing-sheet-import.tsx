'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { applyHearingSheet, generateInitialDraft } from '@/lib/jizokuka/db'
import { parseHearingSheet } from '@/lib/jizokuka/hearing-sheet'

// クライアントが記入したヒアリングシート（.xlsx）を選ぶと、基本情報・ヒアリング・経費明細に反映し、
// そのまま AI で申請書用に肉付け（下書き生成）まで進められる。
// Googleスプレッドシートの場合は「ファイル → ダウンロード → .xlsx」で保存したものを選ぶ。
export function HearingSheetImport({ caseId }: { caseId: string }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'generating'>('idle')

  const handleFile = async (file: File) => {
    setStatus('reading')
    try {
      const parsed = await parseHearingSheet(await file.arrayBuffer())
      const summary = [
        `基本情報 ${Object.keys(parsed.basic).length}項目`,
        `ヒアリング ${Object.keys(parsed.hearing).length}項目`,
        `経費明細 ${parsed.expenses.length}件（既存の行の後ろに追加）`,
      ].join(' / ')
      if (!window.confirm(`「${file.name}」を反映します。\n${summary}\n\nシートに記入のある項目は、現在の入力内容を上書きします。よろしいですか？`)) return

      await applyHearingSheet(caseId, parsed, file.name)

      if (window.confirm('反映しました。続けてAIで申請書用の下書きに肉付けしますか？\n（キャンセルすると反映のみで終わります。あとでヒアリング画面から生成できます）')) {
        setStatus('generating')
        await generateInitialDraft(caseId)
        router.push(`/jizokuka-pilot/cases/${caseId}/review`)
        return
      }
      window.location.reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ヒアリングシートの反映に失敗しました')
    } finally {
      setStatus('idle')
      if (input.current) input.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={ev => ev.target.files?.[0] && handleFile(ev.target.files[0])}
      />
      <button type="button" className="btn-secondary" disabled={status !== 'idle'} onClick={() => input.current?.click()}>
        {status === 'reading' ? '読み込み中…' : status === 'generating' ? 'AIが肉付け中…' : 'ヒアリングシートを反映'}
      </button>
    </>
  )
}
