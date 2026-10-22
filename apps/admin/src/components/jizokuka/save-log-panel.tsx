'use client'

import { useEffect, useState } from 'react'
import {
  fetchSaveLog, fetchAiUsage, formatYen, JPY_PER_USD,
  type SaveLogEntry, type AiUsageEntry,
} from '@/lib/jizokuka/save-log'

// 案件の保存ログ（直近100件）とAI利用料。AI処理が終わると、直前の処理の概算費用を上部に表示する。
// 料金はトークン数からの概算（Claude APIの公表単価、1ドル=150円で換算）。ウェブ検索そのものの料金は含まない。
export function SaveLogPanel({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<SaveLogEntry[] | null>(null)
  const [usage, setUsage] = useState<AiUsageEntry[] | null>(null)
  const [error, setError] = useState('')
  const [lastCost, setLastCost] = useState<{ operation: string; yen: number } | null>(null)

  const load = () => Promise.all([fetchSaveLog(caseId), fetchAiUsage(caseId)])
    .then(([r, u]) => { setRows(r); setUsage(u); setError('') })
    .catch(e => setError(e instanceof Error ? e.message : '読み込みに失敗しました'))
  useEffect(() => { if (open) load() }, [open, caseId]) // eslint-disable-line react-hooks/exhaustive-deps

  // AI処理の直後に、今回の費用を表示する（開いているときは一覧も更新）
  useEffect(() => {
    const onCost = (ev: Event) => {
      setLastCost((ev as CustomEvent<{ operation: string; yen: number }>).detail)
      if (open) setTimeout(load, 800)
    }
    window.addEventListener('jizokuka-ai-cost', onCost)
    return () => window.removeEventListener('jizokuka-ai-cost', onCost)
  }, [open, caseId]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalYen = (usage ?? []).reduce((sum, u) => sum + u.cost_usd * JPY_PER_USD, 0)

  return (
    <div className="card p-4">
      {lastCost && (
        <p className="mb-2 rounded bg-violet-50 p-2 text-xs text-violet-800">
          直前のAI処理（{lastCost.operation}）の費用: {formatYen(lastCost.yen)}
        </p>
      )}
      <div className="flex items-center justify-between">
        <button type="button" className="text-sm font-medium text-slate-700" onClick={() => setOpen(!open)}>
          {open ? '▼' : '▶'} 保存ログ・AI利用料
        </button>
        {open && <button type="button" className="text-xs text-slate-500 hover:text-slate-900" onClick={load}>更新</button>}
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-5 overflow-x-auto">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {!rows && !error && <p className="text-xs text-slate-400">読み込み中…</p>}

          {usage && (
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">
                AI利用料（この案件の累計） <span className="text-base font-bold text-slate-900">{formatYen(totalYen)}</span>
                <span className="ml-2 text-xs font-normal text-slate-400">{usage.length}回</span>
              </p>
              {usage.length === 0 ? (
                <p className="text-xs text-slate-400">まだAIを使っていません</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-left text-slate-500">
                    <tr><th className="py-1 pr-3">日時</th><th className="py-1 pr-3">操作</th><th className="py-1 pr-3 text-right">入力/出力トークン</th><th className="py-1 pr-3 text-right">検索</th><th className="py-1 text-right">費用</th></tr>
                  </thead>
                  <tbody>
                    {usage.map(u => (
                      <tr key={u.id} className="border-t border-slate-100">
                        <td className="whitespace-nowrap py-1 pr-3 text-slate-600">{new Date(u.created_at).toLocaleString('ja-JP')}</td>
                        <td className="whitespace-nowrap py-1 pr-3 text-slate-800">{u.operation}</td>
                        <td className="whitespace-nowrap py-1 pr-3 text-right tabular-nums text-slate-600">{u.input_tokens.toLocaleString()} / {u.output_tokens.toLocaleString()}</td>
                        <td className="py-1 pr-3 text-right tabular-nums text-slate-600">{u.web_searches || '—'}</td>
                        <td className="whitespace-nowrap py-1 text-right tabular-nums text-slate-800">{formatYen(u.cost_usd * JPY_PER_USD)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                トークン数とClaude APIの公表単価からの概算です（1ドル={JPY_PER_USD}円で換算）。ウェブ検索そのものの料金は含みません。実際の請求額はAnthropicの利用明細で確認してください。
              </p>
            </div>
          )}

          {rows && (
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">保存ログ</p>
              {rows.length === 0 && <p className="text-xs text-slate-400">まだ保存ログがありません</p>}
              {rows.length > 0 && (
                <table className="w-full text-xs">
                  <thead className="text-left text-slate-500">
                    <tr><th className="py-1 pr-3">日時</th><th className="py-1 pr-3">操作</th><th className="py-1 pr-3">保存した項目</th><th className="py-1">担当</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} className="border-t border-slate-100 align-top">
                        <td className="whitespace-nowrap py-1 pr-3 text-slate-600">{new Date(r.created_at).toLocaleString('ja-JP')}</td>
                        <td className="whitespace-nowrap py-1 pr-3 text-slate-800">{r.source}</td>
                        <td className="py-1 pr-3 text-slate-600">{r.summary || '—'}</td>
                        <td className="whitespace-nowrap py-1 text-slate-500">{r.actor ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
