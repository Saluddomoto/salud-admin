'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  fetchDocuments, insertDocument, deleteDocument, type DbDocument,
} from '@/lib/db'

type Parent = { customerId: string } | { projectId: string }

function isDriveUrl(url: string): boolean {
  return /(?:drive|docs)\.google\.com/.test(url)
}

/** 顧客・案件に Google Drive などの資料リンクを紐づけるカード */
export function DocumentsCard({ parent }: { parent: Parent }) {
  const [docs,    setDocs]    = useState<DbDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [adding,  setAdding]  = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const key = 'customerId' in parent ? parent.customerId : parent.projectId

  const load = useCallback(() => {
    fetchDocuments(parent)
      .then(setDocs)
      .catch(() => setError('資料の取得に失敗しました'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(load, [load])

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const form = e.currentTarget
    const f = new FormData(form)
    const url = (f.get('url') as string).trim()
    const title = ((f.get('title') as string) || '').trim() || '無題の資料'
    try {
      await insertDocument(parent, { title, url })
      form.reset()
      setAdding(false)
      load()
    } catch {
      setError('追加に失敗しました（権限がない可能性があります）')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (d: DbDocument) => {
    if (!confirm(`「${d.title}」のリンクを外しますか？\n（Drive上のファイル自体は削除されません）`)) return
    setDocs(prev => prev.filter(x => x.id !== d.id))
    try {
      await deleteDocument(d.id)
    } catch {
      setError('削除に失敗しました')
      load()
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">資料</h3>
        <button
          className="text-xs font-medium text-brand-600 hover:underline"
          onClick={() => setAdding(v => !v)}
        >
          {adding ? '閉じる' : '+ 追加'}
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
      )}

      {adding && (
        <form onSubmit={handleAdd} className="mb-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <input
            name="url" required type="url" className="input text-sm"
            placeholder="Google Drive などのURLを貼り付け"
          />
          <input
            name="title" className="input text-sm"
            placeholder="表示名（例: 申請書類・見積書。空欄可）"
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={() => setAdding(false)}>
              キャンセル
            </button>
            <button type="submit" disabled={saving} className="btn-primary text-xs">
              {saving ? '追加中...' : '追加'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {loading && <p className="py-6 text-center text-xs text-slate-400">読み込み中...</p>}
        {!loading && docs.map(d => (
          <div key={d.id} className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50">
            <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
              isDriveUrl(d.url) ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1"
            >
              <p className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-600">{d.title}</p>
              <p className="truncate text-xs text-slate-400">
                {isDriveUrl(d.url) ? 'Google Drive' : d.url}
              </p>
            </a>
            <button
              className="invisible flex-shrink-0 text-xs text-slate-400 hover:text-rose-600 group-hover:visible"
              onClick={() => handleDelete(d)}
            >
              外す
            </button>
          </div>
        ))}
        {!loading && docs.length === 0 && !adding && (
          <p className="py-6 text-center text-xs text-slate-400">
            資料はまだありません。「+ 追加」でDriveのリンクを貼れます。
          </p>
        )}
      </div>
    </div>
  )
}
