'use client'

import { useEffect, useState } from 'react'
import { fetchSaveLog, type SaveLogEntry } from '@/lib/jizokuka/save-log'

// 案件の保存ログ（直近100件）。開いたときと「更新」を押したときに読み込む。
export function SaveLogPanel({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<SaveLogEntry[] | null>(null)
  const [error, setError] = useState('')

  const load = () => fetchSaveLog(caseId).then(r => { setRows(r); setError('') }).catch(e => setError(e instanceof Error ? e.message : '読み込みに失敗しました'))
  useEffect(() => { if (open) load() }, [open, caseId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <button type="button" className="text-sm font-medium text-slate-700" onClick={() => setOpen(!open)}>
          {open ? '▼' : '▶'} 保存ログ
        </button>
        {open && <button type="button" className="text-xs text-slate-500 hover:text-slate-900" onClick={load}>更新</button>}
      </div>
      {open && (
        <div className="mt-3 overflow-x-auto">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {!rows && !error && <p className="text-xs text-slate-400">読み込み中…</p>}
          {rows && rows.length === 0 && <p className="text-xs text-slate-400">まだ保存ログがありません</p>}
          {rows && rows.length > 0 && (
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
  )
}
