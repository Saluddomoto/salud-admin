'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adjacentSteps, stepPath, type JizokukaStep } from '@/lib/jizokuka/steps'

// 5画面共通の「一時保存（一覧へ）」「戻る」「進む」。
// onSave は各ページが自分の入力内容を保存する処理を渡す（不要なページは async () => {} でよい）。
export function StepNav({ caseId, step, onSave }: {
  caseId: string
  step: JizokukaStep
  onSave: () => Promise<void>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const { prev, next } = adjacentSteps(step)

  const runAndGo = async (path: string) => {
    setBusy(true)
    try {
      await onSave()
      router.push(path)
    } catch (e) {
      alert(`保存に失敗しました: ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => runAndGo('/jizokuka-pilot')}>
        一時保存（一覧へ）
      </button>
      {prev && (
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => runAndGo(stepPath(caseId, prev))}>
          戻る
        </button>
      )}
      {next && (
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => runAndGo(stepPath(caseId, next))}>
          進む
        </button>
      )}
    </>
  )
}
