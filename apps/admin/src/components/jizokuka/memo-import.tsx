'use client'

import { useState } from 'react'
import { fetchBasicInfo, saveBasicInfo, saveHearing, type JizokukaHearing } from '@/lib/jizokuka/db'

type Proposal = { target: 'hearing' | 'basic'; key: string; label: string; value: string }
type Row = Proposal & { current: string; mode: 'append' | 'replace'; applied: boolean }

// ヒアリング中の自由記述メモを貼り付けると、AIが入力項目ごとに振り分けて提案する。
// 項目ごとに「反映」ボタンで保存する（既存の入力がある項目は追記／置き換えを選べる）。
export function MemoImport({ caseId, hearing, onApplied }: { caseId: string; hearing: JizokukaHearing; onApplied: () => void }) {
  const [open, setOpen] = useState(false)
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [unmatched, setUnmatched] = useState('')
  const [maskedCount, setMaskedCount] = useState(0)

  const analyze = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/jizokuka/cases/${caseId}/parse-memo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memo }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? '振り分けに失敗しました')
      const basic = await fetchBasicInfo(caseId)
      const cur = (p: Proposal) =>
        String(((p.target === 'hearing' ? hearing : basic) as unknown as Record<string, unknown>)[p.key] ?? '')
      setRows((body.proposals as Proposal[]).map(p => {
        const current = cur(p)
        return { ...p, current, mode: current ? 'append' : 'replace', applied: false } as Row
      }))
      setUnmatched(body.unmatched ?? '')
      setMaskedCount(body.maskedCount ?? 0)
    } catch (e) {
      alert(e instanceof Error ? e.message : '振り分けに失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const apply = async (r: Row) => {
    const value = r.mode === 'append' && r.current ? `${r.current}\n${r.value}` : r.value
    try {
      if (r.target === 'hearing') await saveHearing(caseId, { [r.key]: value })
      else await saveBasicInfo(caseId, { [r.key]: value })
      setRows(prev => prev!.map(x => (x.key === r.key ? { ...x, applied: true, current: value } : x)))
      onApplied()
    } catch (e) {
      alert(e instanceof Error ? e.message : '反映に失敗しました')
    }
  }

  const applyAll = async () => {
    for (const r of rows!) if (!r.applied) await apply(r)
  }

  const edit = (i: number, patch: Partial<Row>) => setRows(rows!.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  return (
    <div className="card p-4">
      <button type="button" className="text-sm font-medium text-slate-700" onClick={() => setOpen(!open)}>
        {open ? '▼' : '▶'} ヒアリングメモを貼り付けて振り分ける
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            ヒアリング中のメモを自由に貼り付けてください。AIが入力項目ごとに振り分けて提案します（メモに無い内容は補いません）。内容を確認して「反映」を押した項目だけが保存されます。
          </p>
          <p className="rounded bg-sky-50 p-2 text-xs text-sky-800">
            個人情報の保護: 電話番号・メール・生年月日・郵便番号・マイナンバー・口座番号・登録済みの代表者名／事業者名は、AIへ送る前に自動で伏せ字にします（AIには実データを渡しません）。電話・メール・生年月日・郵便番号は、AIを通さず基本情報へ直接振り分けます。マイナンバーと口座番号は保存しません。それ以外の氏名や住所は伏せられないため、メモに書く際はご注意ください。
          </p>
          <textarea className="input min-h-40" value={memo} onChange={ev => setMemo(ev.target.value)} placeholder="例: 創業20年、地元産そば粉を石臼で自家製粉。客層は60代中心。コロナ後の客足が戻らず…" />
          <div>
            <button type="button" className="btn-primary" disabled={busy || !memo.trim()} onClick={analyze}>
              {busy ? 'AIが振り分け中…' : '振り分ける'}
            </button>
          </div>

          {rows && (
            <div className="flex flex-col gap-3">
              {maskedCount > 0 && <p className="text-xs text-slate-500">個人情報 {maskedCount} 件を伏せ字にしてAIへ送信しました。</p>}
              {rows.length === 0 && <p className="text-sm text-slate-500">振り分けられる項目が見つかりませんでした。</p>}
              {rows.map((r, i) => (
                <div key={r.key} className="rounded border border-slate-200 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {r.label}<span className="ml-2 text-xs text-slate-400">{r.target === 'basic' ? '基本情報' : 'ヒアリング'}</span>
                    </span>
                    <button type="button" className="btn-secondary" disabled={r.applied} onClick={() => apply(r)}>
                      {r.applied ? '反映済' : '反映'}
                    </button>
                  </div>
                  <textarea className="input min-h-16" value={r.value} onChange={ev => edit(i, { value: ev.target.value })} disabled={r.applied} />
                  {r.current && !r.applied && (
                    <div className="mt-1 text-xs text-slate-500">
                      <p className="whitespace-pre-wrap">現在の入力: {r.current}</p>
                      <label className="mr-3"><input type="radio" checked={r.mode === 'append'} onChange={() => edit(i, { mode: 'append' })} /> 追記</label>
                      <label><input type="radio" checked={r.mode === 'replace'} onChange={() => edit(i, { mode: 'replace' })} /> 置き換え</label>
                    </div>
                  )}
                </div>
              ))}
              {rows.some(r => !r.applied) && (
                <div><button type="button" className="btn-primary" onClick={applyAll}>未反映をすべて反映</button></div>
              )}
              {unmatched && (
                <div className="rounded bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="mb-1 font-medium">振り分けできなかった内容</p>
                  <p className="whitespace-pre-wrap">{unmatched}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
