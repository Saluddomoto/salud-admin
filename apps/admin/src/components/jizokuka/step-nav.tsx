'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { JIZOKUKA_STEPS, stepPath, type JizokukaStep } from '@/lib/jizokuka/steps'

const STEP_LABELS: Record<JizokukaStep, string> = {
  'basic-info': '基本情報',
  hearing: 'ヒアリング',
  expenses: '経費明細',
  review: 'レビュー',
  export: 'エクスポート',
}

// 5画面共通の「一時保存（一覧へ）」ボタン。
// onSave は各ページが自分の入力内容を保存する処理を渡す（不要なページは async () => {} でよい）。
export function StepNav({ onSave }: { onSave: () => Promise<void> }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    setBusy(true)
    try {
      await onSave()
      router.push('/jizokuka-pilot')
    } catch (e) {
      alert(`保存に失敗しました: ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className="btn-secondary" disabled={busy} onClick={handleClick}>
      一時保存（一覧へ）
    </button>
  )
}

// 5画面共通の上部タブ。どのパートからでもクリックで直接移動できる
// （移動前に現在ページの内容を保存する）。
export function StepTabs({ caseId, current, onSave }: {
  caseId: string
  current: JizokukaStep
  onSave: () => Promise<void>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const go = async (step: JizokukaStep) => {
    if (step === current || busy) return
    setBusy(true)
    try {
      await onSave()
      router.push(stepPath(caseId, step))
    } catch (e) {
      alert(`保存に失敗しました: ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {JIZOKUKA_STEPS.map(step => (
        <button
          key={step}
          type="button"
          disabled={busy}
          onClick={() => go(step)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            step === current
              ? 'bg-brand-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {STEP_LABELS[step]}
        </button>
      ))}
    </div>
  )
}
