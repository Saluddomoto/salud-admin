'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import {
  fetchKnowhowNotes, insertKnowhowNote, updateKnowhowNote, deleteKnowhowNote,
  type DbKnowhowNote,
} from '@/lib/db'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function KnowhowPage() {
  const [notes,    setNotes]    = useState<DbKnowhowNote[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [query,    setQuery]    = useState('')
  const [category, setCategory] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [detail,  setDetail]  = useState<DbKnowhowNote | null>(null)

  const load = () => {
    fetchKnowhowNotes()
      .then(setNotes)
      .catch(() => setError('ノウハウノートの取得に失敗しました'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const categories = useMemo(
    () => Array.from(new Set(notes.map(n => n.category).filter((c): c is string => !!c))).sort(),
    [notes],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes.filter(n => {
      if (category && n.category !== category) return false
      if (!q) return true
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    })
  }, [notes, query, category])

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const f = new FormData(e.currentTarget)
    try {
      await insertKnowhowNote({
        title:    (f.get('title') as string).trim(),
        category: (f.get('category') as string)?.trim() || null,
        body:     (f.get('body') as string).trim(),
      })
      setAddOpen(false)
      load()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="ノウハウノート" description="事務手引きなど「やり方がわかる」記事を、全員で書いて共有します">
        <button className="btn-primary text-sm" onClick={() => setAddOpen(true)}>+ ノートを追加</button>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="タイトル・本文で検索"
          className="input sm:max-w-xs"
        />
        {categories.length > 0 && (
          <select value={category} onChange={e => setCategory(e.target.value)} className="input sm:max-w-[10rem]">
            <option value="">すべてのカテゴリ</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {loading && <p className="p-12 text-center text-sm text-slate-400">読み込み中...</p>}

        {!loading && filtered.map(n => (
          <button
            key={n.id}
            onClick={() => setDetail(n)}
            className="card flex items-start gap-4 p-4 text-left transition-shadow hover:shadow-md"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {n.category && <span className="badge bg-brand-50 text-xs text-brand-700">{n.category}</span>}
                <p className="text-sm font-semibold text-slate-900">{n.title}</p>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>
              <p className="mt-1.5 text-xs text-slate-400">
                {formatDate(n.updated_at)} 更新{n.editor ? ` · ${n.editor.full_name}` : ''}
              </p>
            </div>
          </button>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="card p-12 text-center text-sm text-slate-400">
            {notes.length === 0
              ? <>ノウハウノートがまだありません。「＋ノートを追加」から書いてみましょう。</>
              : <>該当するノートが見つかりませんでした。</>}
          </div>
        )}
      </div>

      {/* 追加モーダル */}
      <Modal title="ノウハウノートを追加" open={addOpen} onClose={() => setAddOpen(false)}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">タイトル *</label>
            <input name="title" required className="input" placeholder="請求書の発行手順" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">カテゴリ</label>
            <input name="category" list="knowhow-categories" className="input" placeholder="事務手引き" />
            <datalist id="knowhow-categories">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">本文 *</label>
            <textarea name="body" required rows={10} className="input resize-y" placeholder="手順ややり方を書いてください" />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary text-sm" onClick={() => setAddOpen(false)}>キャンセル</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </Modal>

      {/* 詳細・編集モーダル */}
      {detail && (
        <DetailModal
          note={detail}
          categories={categories}
          onClose={() => setDetail(null)}
          onSaved={() => { setDetail(null); load() }}
        />
      )}
    </div>
  )
}

function DetailModal({ note, categories, onClose, onSaved }: {
  note: DbKnowhowNote
  categories: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title,    setTitle]    = useState(note.title)
  const [category, setCategory] = useState(note.category ?? '')
  const [body,     setBody]     = useState(note.body)
  const [busy,     setBusy]     = useState(false)
  const [err,      setErr]      = useState('')

  const save = async () => {
    setBusy(true)
    setErr('')
    try {
      await updateKnowhowNote(note.id, {
        title: title.trim(),
        category: category.trim() || null,
        body: body.trim(),
      })
      onSaved()
    } catch {
      setErr('保存に失敗しました')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('このノートを削除しますか？')) return
    setBusy(true)
    try {
      await deleteKnowhowNote(note.id)
      onSaved()
    } catch {
      setErr('削除に失敗しました')
      setBusy(false)
    }
  }

  return (
    <Modal title="ノウハウノート" open onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">タイトル</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">カテゴリ</label>
          <input value={category} onChange={e => setCategory(e.target.value)} list="knowhow-categories" className="input" />
          <datalist id="knowhow-categories">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">本文</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={12} className="input resize-y" />
        </div>
        <p className="text-xs text-slate-400">
          {note.author ? `作成: ${note.author.full_name}` : ''}
          {note.editor ? ` · 最終更新: ${note.editor.full_name}` : ''}
        </p>

        {err && <p className="text-sm text-rose-600">{err}</p>}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <button onClick={remove} disabled={busy} className="text-sm text-rose-500 hover:text-rose-600">削除</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">閉じる</button>
            <button onClick={save} disabled={busy} className="btn-primary text-sm">{busy ? '保存中...' : '保存'}</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
