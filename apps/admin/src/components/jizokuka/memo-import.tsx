'use client'

import { useEffect, useRef, useState } from 'react'
import {
  fetchBasicInfo, saveBasicInfo, saveHearing, fetchMemos, saveMemo, markMemoApplied, deleteMemo,
  type JizokukaHearing, type JizokukaMemo, type TopService,
} from '@/lib/jizokuka/db'

type Kind = 'text' | 'number' | 'services'
type Proposal = { target: 'hearing' | 'basic'; key: string; label: string; value: string; kind?: Kind }
type Row = Proposal & { kind: Kind; current: string; mode: 'append' | 'replace'; applied: boolean }

const servicesToLines = (v: TopService[]) =>
  v.map(t => `${t.name}｜${t.ratio_pct ?? ''}｜${t.unit_price ?? ''}`).join('\n')

const linesToServices = (text: string): TopService[] =>
  text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [name = '', ratio = '', price = ''] = l.split(/[｜|]/).map(x => x.trim())
    const num = (x: string) => (x === '' || Number.isNaN(Number(x)) ? null : Number(x))
    return { name, ratio_pct: num(ratio), unit_price: num(price) }
  }).filter(t => t.name)

// ヒアリング中の自由記述メモを貼り付けると、AIが入力項目ごとに振り分けて提案する。
// 項目ごとに「反映」ボタンで保存する（既存の入力がある項目は追記／置き換えを選べる）。
// 貼り付けたメモの原文は案件ごとに保存し、あとから見返せる。
export function MemoImport({ caseId, hearing, onApplied }: { caseId: string; hearing: JizokukaHearing; onApplied: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [unmatched, setUnmatched] = useState('')
  const [maskedCount, setMaskedCount] = useState(0)
  const [history, setHistory] = useState<JizokukaMemo[]>([])
  const [viewing, setViewing] = useState<string | null>(null)
  const memoId = useRef<string | null>(null)
  const appliedLabels = useRef<string[]>([])

  const loadHistory = () => fetchMemos(caseId).then(setHistory).catch(() => {})
  useEffect(() => { loadHistory() }, [caseId]) // eslint-disable-line react-hooks/exhaustive-deps

  const analyze = async () => {
    setBusy(true)
    try {
      // 先に原文を保存する（振り分けに失敗しても、メモは失われない）
      const saved = await saveMemo(caseId, memo)
      memoId.current = saved.id
      appliedLabels.current = []
      loadHistory()

      const res = await fetch(`/api/jizokuka/cases/${caseId}/parse-memo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memo }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`${body.error ?? '振り分けに失敗しました'}（メモは保存済みです）`)
      const basic = await fetchBasicInfo(caseId)
      const cur = (p: Proposal): string => {
        const v = ((p.target === 'hearing' ? hearing : basic) as unknown as Record<string, unknown>)[p.key]
        if (Array.isArray(v)) return servicesToLines(v as TopService[])
        return v == null ? '' : String(v)
      }
      const next = (body.proposals as Proposal[]).map(p => {
        const current = cur(p)
        return { ...p, kind: p.kind ?? 'text', current, mode: current ? 'append' : 'replace', applied: false } as Row
      })
      setRows(next)
      setUnmatched(body.unmatched ?? '')
      setMaskedCount(body.maskedCount ?? 0)
      // 自動保存: 空の項目は入力、入力済みの文章は追記。入力済みの数値は上書きせず、ボタンで選ばせる
      for (const r of next) {
        if (r.kind === 'number' && r.current) continue
        if (!(await apply(r))) break
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '振り分けに失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const apply = async (r: Row): Promise<boolean> => {
    try {
      if (r.kind === 'services') {
        const merged = [
          ...(r.mode === 'append' ? ((hearing.top_services ?? []) as TopService[]) : []),
          ...linesToServices(r.value),
        ]
        await saveHearing(caseId, { top_services: merged })
      } else if (r.kind === 'number') {
        const n = Number(r.value.replace(/,/g, ''))
        if (Number.isNaN(n)) throw new Error(`「${r.label}」は数値で入力してください`)
        await saveHearing(caseId, { [r.key]: n })
      } else {
        const value = r.mode === 'append' && r.current ? `${r.current}\n${r.value}` : r.value
        if (r.target === 'hearing') await saveHearing(caseId, { [r.key]: value })
        else await saveBasicInfo(caseId, { [r.key]: value })
      }
      setRows(prev => prev!.map(x => (x.key === r.key ? { ...x, applied: true } : x)))
      appliedLabels.current = [...appliedLabels.current, r.label]
      if (memoId.current) markMemoApplied(memoId.current, appliedLabels.current).then(loadHistory).catch(() => {})
      await onApplied()
      return true
    } catch (e) {
      alert(e instanceof Error ? e.message : '反映に失敗しました')
      return false
    }
  }

  // 1件ずつ順に反映する（同時に走らせると画面の再読込が前後して古い内容に戻ることがある）
  const applyAll = async () => {
    for (const r of rows!) if (!r.applied) await apply(r)
  }

  const edit = (key: string, patch: Partial<Row>) => setRows(prev => prev!.map(x => (x.key === key ? { ...x, ...patch } : x)))

  const remove = async (m: JizokukaMemo) => {
    if (!window.confirm('この保存済みメモを削除します。（すでに反映した入力内容は消えません）')) return
    await deleteMemo(m.id).catch(e => alert(e instanceof Error ? e.message : '削除に失敗しました'))
    loadHistory()
  }

  return (
    <div className="card p-4">
      <button type="button" className="text-sm font-medium text-slate-700" onClick={() => setOpen(!open)}>
        {open ? '▼' : '▶'} ヒアリングメモを貼り付けて振り分ける{history.length > 0 && `（保存済み ${history.length}件）`}
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            ヒアリング中のメモを自由に貼り付けてください。AIが入力項目ごとに振り分けて提案します（メモに無い内容は補いません）。振り分けた内容は、自動でヒアリングの入力欄に保存されます（空の項目は入力、入力済みの文章は追記。入力済みの数値だけは上書きせず、ボタンで選べます）。一時保存は不要です。貼り付けたメモの原文は、この案件に保存され、下の一覧からいつでも見返せます。
          </p>
          <p className="rounded bg-sky-50 p-2 text-xs text-sky-800">
            個人情報の保護: 電話番号・メール・生年月日・郵便番号・マイナンバー・口座番号・登録済みの代表者名／事業者名は、AIへ送る前に自動で伏せ字にします（AIには実データを渡しません）。電話・メール・生年月日・郵便番号は、AIを通さず基本情報へ直接振り分けます。マイナンバーと口座番号は、反映の対象にしません（ただし、メモの原文は保存されます。書かないことをおすすめします）。それ以外の氏名や住所は伏せられないため、メモに書く際はご注意ください。
          </p>
          <textarea className="input min-h-40" value={memo} onChange={ev => setMemo(ev.target.value)} placeholder="例: 創業20年、地元産そば粉を石臼で自家製粉。客層は60代中心。コロナ後の客足が戻らず…" />
          <div>
            <button type="button" className="btn-primary" disabled={busy || !memo.trim()} onClick={analyze}>
              {busy ? 'AIが振り分け中…' : '振り分ける'}
            </button>
          </div>

          {rows && (
            <div className="flex flex-col gap-3">
              {rows.length > 0 && rows.every(r => r.applied) && (
                <p className="rounded bg-emerald-50 p-2 text-xs text-emerald-800">すべて保存しました。上のヒアリングの入力欄にも反映されています。</p>
              )}
              {maskedCount > 0 && <p className="text-xs text-slate-500">個人情報 {maskedCount} 件を伏せ字にしてAIへ送信しました。</p>}
              {rows.length === 0 && <p className="text-sm text-slate-500">振り分けられる項目が見つかりませんでした。</p>}
              {rows.map(r => (
                <div key={r.key} className="rounded border border-slate-200 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {r.label}<span className="ml-2 text-xs text-slate-400">{r.target === 'basic' ? '基本情報' : 'ヒアリング'}</span>
                    </span>
                    <button type="button" className="btn-secondary" disabled={r.applied} onClick={() => apply(r)}>
                      {r.applied ? '✓ 保存済み' : '反映して保存'}
                    </button>
                  </div>
                  {r.kind === 'services' && <p className="mb-1 text-xs text-slate-400">1行1件「名前｜売上比率%｜単価」</p>}
                  <textarea className="input min-h-16" value={r.value} onChange={ev => edit(r.key, { value: ev.target.value })} disabled={r.applied} />
                  {r.current && !r.applied && r.kind !== 'number' && (
                    <div className="mt-1 text-xs text-slate-500">
                      <p className="whitespace-pre-wrap">現在の入力: {r.current}</p>
                      <label className="mr-3"><input type="radio" checked={r.mode === 'append'} onChange={() => edit(r.key, { mode: 'append' })} /> 追記</label>
                      <label><input type="radio" checked={r.mode === 'replace'} onChange={() => edit(r.key, { mode: 'replace' })} /> 置き換え</label>
                    </div>
                  )}
                  {r.current && !r.applied && r.kind === 'number' && (
                    <p className="mt-1 text-xs text-slate-500">現在の入力: {r.current}（反映すると置き換わります）</p>
                  )}
                </div>
              ))}
              {rows.some(r => !r.applied) && (
                <div><button type="button" className="btn-primary" onClick={applyAll}>未反映をすべて反映して保存</button></div>
              )}
              {unmatched && (
                <div className="rounded bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="mb-1 font-medium">振り分けできなかった内容</p>
                  <p className="whitespace-pre-wrap">{unmatched}</p>
                </div>
              )}
            </div>
          )}

          {history.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-sm font-medium text-slate-700">保存済みのメモ</p>
              <div className="flex flex-col gap-2">
                {history.map(m => (
                  <div key={m.id} className="rounded border border-slate-200 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" className="text-left text-slate-700" onClick={() => setViewing(viewing === m.id ? null : m.id)}>
                        {viewing === m.id ? '▼' : '▶'} {new Date(m.created_at).toLocaleString('ja-JP')}
                        <span className="text-slate-500">{m.body.replace(/\s+/g, ' ').slice(0, 40)}…</span>
                      </button>
                      <span className="flex shrink-0 gap-3">
                        <button type="button" className="text-slate-500 hover:text-slate-900" onClick={() => setMemo(m.body)}>入力欄に戻す</button>
                        <button type="button" className="text-red-500 hover:text-red-700" onClick={() => remove(m)}>削除</button>
                      </span>
                    </div>
                    {m.applied_labels.length > 0 && (
                      <p className="mt-1 text-slate-500">反映した項目: {m.applied_labels.join('、')}</p>
                    )}
                    {viewing === m.id && <p className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-slate-700">{m.body}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
