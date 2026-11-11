'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { applyHearingSheet, fetchCaseDetail, fetchExpenseKeys, generateInitialDraft, updateCaseNames } from '@/lib/jizokuka/db'
import { parseHearingSheet } from '@/lib/jizokuka/hearing-sheet'

// クライアントが記入したヒアリングシート（.xlsx）を選ぶと、基本情報・ヒアリング・経費明細に反映し、
// そのまま AI で申請書用に肉付け（下書き生成）まで進められる。
// Googleスプレッドシートの場合は「ファイル → ダウンロード → .xlsx」で保存したものを選ぶ。
export function HearingSheetImport({ caseId }: { caseId: string }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'generating'>('idle')
  const cancelled = useRef(false)
  const abort = useRef<AbortController | null>(null)

  const cancel = () => {
    cancelled.current = true
    abort.current?.abort()
  }

  // 読み込み・AI生成中にページを離れると処理が途中で止まるため、離脱時にブラウザ警告を出す
  useEffect(() => {
    if (status === 'idle') return
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [status])

  const handleFile = async (file: File) => {
    cancelled.current = false
    abort.current = null
    setStatus('reading')
    try {
      const parsed = await parseHearingSheet(await file.arrayBuffer())
      const summary = [
        `基本情報 ${Object.keys(parsed.basic).length}項目`,
        `ヒアリング ${Object.keys(parsed.hearing).length}項目`,
        `経費明細 ${parsed.expenses.length}件（既存の行の後ろに追加）`,
      ].join(' / ')
      // 同じシートの再反映チェック（ファイル名が前回と同じ／経費明細が既に登録済み）
      const [{ hearing: prev }, existingKeys] = await Promise.all([fetchCaseDetail(caseId), fetchExpenseKeys(caseId)])
      if (cancelled.current) return
      const dupExpenses = parsed.expenses.filter(e => existingKeys.includes(`${e.category}|${e.description}|${e.amount}`)).length
      const sameFile = !!prev.sheet_file_name && prev.sheet_file_name === file.name
      if (sameFile || dupExpenses > 0) {
        const lines = [
          '⚠ このヒアリングシートは、すでに反映済みの可能性があります。',
          sameFile ? `・前回反映したファイルと同じ名前です（${prev.sheet_file_name}）` : '',
          dupExpenses > 0 ? `・経費明細 ${dupExpenses}件が、すでに登録済みの内容と同じです（反映すると二重に追加されます）` : '',
          '',
          'このまま反映を続けますか？（キャンセルで中止）',
        ]
        if (!window.confirm(lines.join('\n'))) return
      }
      if (!window.confirm(`「${file.name}」を反映します。\n${summary}\n\nシートに記入のある項目は、現在の入力内容を上書きします。よろしいですか？`)) return

      if (cancelled.current) return
      await applyHearingSheet(caseId, parsed, file.name)

      // 下書き・エクスポートは案件の事業者名を使うため、シートの会社と違えば合わせるか確認する
      const { case: current } = await fetchCaseDetail(caseId)
      if (parsed.businessName && parsed.businessName !== current.business_name) {
        if (window.confirm(`この案件の事業者名は「${current.business_name}」ですが、シートの事業者名は「${parsed.businessName}」です。
案件の事業者名${parsed.representative ? '・代表者名' : ''}をシートの内容に更新しますか？
（更新しないと、AI下書きやエクスポートが「${current.business_name}」のままになります）`)) {
          await updateCaseNames(caseId, {
            business_name: parsed.businessName,
            ...(parsed.representative ? { representative: parsed.representative } : {}),
          })
        }
      }

      if (window.confirm('反映しました。続けてAIで申請書用の下書きに肉付けしますか？\n（キャンセルすると反映のみで終わります。あとでヒアリング画面から生成できます）')) {
        setStatus('generating')
        abort.current = new AbortController()
        await generateInitialDraft(caseId, abort.current.signal)
        router.push(`/jizokuka-pilot/cases/${caseId}/review`)
        return
      }
      window.location.reload()
    } catch (e) {
      if (cancelled.current) {
        alert('中止しました。反映済みの内容はそのまま残っています（AI下書きは作り直されていない可能性が高いですが、案件のレビュー画面でご確認ください）。')
        window.location.reload()
        return
      }
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
      {status !== 'idle' && (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-50 bg-red-600 px-4 py-3 text-center text-sm font-bold text-white shadow-lg"
        >
          ⚠ {status === 'reading' ? 'ヒアリングシートを読み込み中' : 'AIが下書きを生成中（1〜数分かかります）'}です。
          この画面から移動・更新・ブラウザを閉じないでください。処理が途中で止まります。
          <button
            type="button"
            onClick={cancel}
            className="ml-4 rounded border border-white bg-white px-3 py-1 text-red-700 hover:bg-red-50"
          >
            反映をやめる
          </button>
        </div>
      )}
    </>
  )
}
