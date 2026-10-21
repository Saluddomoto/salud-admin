'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  fetchProfiles, fetchNewBusinessItems, insertNewBusinessItem, updateNewBusinessItem, deleteNewBusinessItem,
  type DbProfile, type DbNewBusinessItem, type NewBusinessKind, type NewBusinessStatus,
} from '@/lib/db'
import { Modal } from '@/components/Modal'
import {
  fetchNewBusinessNotes, insertNewBusinessNote, updateNewBusinessNote, deleteNewBusinessNote,
  type DbNewBusinessNote,
} from '@/lib/db'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function NotesSection() {
  const [notes,    setNotes]    = useState<DbNewBusinessNote[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [query,    setQuery]    = useState('')
  const [category, setCategory] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [detail,  setDetail]  = useState<DbNewBusinessNote | null>(null)

  const load = () => {
    fetchNewBusinessNotes()
      .then(setNotes)
      .catch(() => setError('新規事業ノートの取得に失敗しました'))
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
      await insertNewBusinessNote({
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
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">ノート（計画・メモ）</h2>
        <button className="btn-primary text-sm" onClick={() => setAddOpen(true)}>+ ノートを追加</button>
      </div>

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
              ? <>新規事業のノートがまだありません。「＋ノートを追加」から書いてみましょう。</>
              : <>該当するノートが見つかりませんでした。</>}
          </div>
        )}
      </div>

      {/* 追加モーダル */}
      <Modal title="新規事業ノートを追加" open={addOpen} onClose={() => setAddOpen(false)}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">タイトル *</label>
            <input name="title" required className="input" placeholder="AI活用型RPO 計画メモ" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">カテゴリ</label>
            <input name="category" list="newbiz-categories" className="input" placeholder="AI活用型RPO" />
            <datalist id="newbiz-categories">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">本文 *</label>
            <textarea name="body" required rows={10} className="input resize-y" placeholder="検討内容・決まったこと・宿題などを書いてください" />
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
    </section>
  )
}

function DetailModal({ note, categories, onClose, onSaved }: {
  note: DbNewBusinessNote
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
      await updateNewBusinessNote(note.id, {
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
      await deleteNewBusinessNote(note.id)
      onSaved()
    } catch {
      setErr('削除に失敗しました')
      setBusy(false)
    }
  }

  return (
    <Modal title="新規事業ノート" open onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">タイトル</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">カテゴリ</label>
          <input value={category} onChange={e => setCategory(e.target.value)} list="newbiz-categories" className="input" />
          <datalist id="newbiz-categories">
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

/* ─── PDCAダッシュボード ─── */
const KIND_LABEL: Record<NewBusinessKind, string> = { decision: '決めること', task: 'タスク', review: '振り返り' }
const STATUS_LABEL: Record<NewBusinessStatus, string> = { open: '未着手', doing: '進行中', done: '完了' }
const STATUS_STYLE: Record<NewBusinessStatus, string> = {
  open: 'bg-slate-100 text-slate-600', doing: 'bg-amber-50 text-amber-700', done: 'bg-emerald-50 text-emerald-700',
}
const todayStr = () => new Date().toISOString().slice(0, 10)

function ItemRow({ it, onOpen, onStatus }: {
  it: DbNewBusinessItem
  onOpen: (it: DbNewBusinessItem) => void
  onStatus: (it: DbNewBusinessItem, s: NewBusinessStatus) => void
}) {
  const late = it.status !== 'done' && it.due_date && it.due_date < todayStr()
  return (
    <div className="card flex items-start gap-3 p-3">
      <button onClick={() => onOpen(it)} className="min-w-0 flex-1 text-left">
        <p className={`text-sm font-medium ${it.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{it.title}</p>
        {it.detail && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{it.detail}</p>}
        {it.kind === 'decision' && it.conclusion && <p className="mt-1 text-xs text-emerald-700">結論: {it.conclusion}</p>}
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-400">
          {it.assignee && <span>{it.assignee.full_name}</span>}
          {it.due_date && <span className={late ? 'font-semibold text-rose-600' : ''}>期限 {it.due_date.slice(5).replace('-', '/')}</span>}
        </p>
      </button>
      <select
        value={it.status}
        onChange={e => onStatus(it, e.target.value as NewBusinessStatus)}
        className={`badge cursor-pointer border-0 text-xs ${STATUS_STYLE[it.status]}`}
      >
        {(['open', 'doing', 'done'] as const).map(st => (
          <option key={st} value={st}>{it.kind === 'decision' && st === 'done' ? '決定' : STATUS_LABEL[st]}</option>
        ))}
      </select>
    </div>
  )
}

function Panel({ step, title, hint, list, onAdd, onOpen, onStatus }: {
  step: string; title: string; hint: string; list: DbNewBusinessItem[]
  onAdd: () => void
  onOpen: (it: DbNewBusinessItem) => void
  onStatus: (it: DbNewBusinessItem, s: NewBusinessStatus) => void
}) {
  const sorted = [...list].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">{step}</span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-400">{hint}</p>
          </div>
        </div>
        <button className="btn-secondary text-xs" onClick={onAdd}>+ 追加</button>
      </div>
      {sorted.map(it => <ItemRow key={it.id} it={it} onOpen={onOpen} onStatus={onStatus} />)}
      {sorted.length === 0 && <div className="card p-6 text-center text-xs text-slate-400">まだありません</div>}
    </section>
  )
}

export default function NewBusinessPage() {
  const [items,    setItems]    = useState<DbNewBusinessItem[]>([])
  const [profiles, setProfiles] = useState<DbProfile[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [addKind,  setAddKind]  = useState<NewBusinessKind | null>(null)
  const [detail,   setDetail]   = useState<DbNewBusinessItem | null>(null)

  const load = () => {
    fetchNewBusinessItems().then(setItems).catch(() => setError('取得に失敗しました')).finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    fetchProfiles().then(p => setProfiles(p.filter(x => x.is_active))).catch(() => {})
  }, [])

  const decisions = items.filter(i => i.kind === 'decision')
  const tasks     = items.filter(i => i.kind === 'task')
  const reviews   = items.filter(i => i.kind === 'review')
  const openDecisions = decisions.filter(i => i.status !== 'done')
  const activeTasks   = tasks.filter(i => i.status !== 'done')
  const overdue       = activeTasks.filter(i => i.due_date && i.due_date < todayStr())
  const doneTasks     = tasks.filter(i => i.status === 'done')

  const setStatus = async (it: DbNewBusinessItem, status: NewBusinessStatus) => {
    try { await updateNewBusinessItem(it.id, { status }); load() } catch { setError('更新に失敗しました') }
  }

  const stats = [
    { step: 'P', label: '未決の決めること', value: openDecisions.length, tone: 'text-brand-700' },
    { step: 'D', label: 'やること（未完了）', value: activeTasks.length, tone: 'text-amber-600' },
    { step: 'D', label: '期限超過', value: overdue.length, tone: overdue.length ? 'text-rose-600' : 'text-slate-400' },
    { step: 'C', label: '完了したタスク', value: doneTasks.length, tone: 'text-emerald-600' },
  ]

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-6">
      <PageHeader title="新規事業" description="PDCAを回すためのボード。決めて（P）、動いて（D）、振り返り（C・A）、ノートに残します" />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={i} className="card p-4">
            <p className="text-xs text-slate-500"><span className="mr-1.5 font-bold text-slate-400">{s.step}</span>{s.label}</p>
            <p className={`mt-1 text-3xl font-bold ${s.tone}`}>{loading ? '–' : s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <Panel step="P" title="決めること" hint="未決を先に・決まったら結論を書く" list={decisions}
          onAdd={() => setAddKind('decision')} onOpen={setDetail} onStatus={setStatus} />
        <Panel step="D" title="タスク" hint="担当と期限を付けて動かす" list={tasks}
          onAdd={() => setAddKind('task')} onOpen={setDetail} onStatus={setStatus} />
        <Panel step="C·A" title="振り返り・次の一手" hint="結果を見て、直すことを残す" list={reviews}
          onAdd={() => setAddKind('review')} onOpen={setDetail} onStatus={setStatus} />
      </div>

      <NotesSection />

      {addKind && (
        <ItemAddModal kind={addKind} profiles={profiles} onClose={() => setAddKind(null)} onSaved={() => { setAddKind(null); load() }} />
      )}
      {detail && (
        <ItemDetailModal item={detail} profiles={profiles} onClose={() => setDetail(null)} onSaved={() => { setDetail(null); load() }} />
      )}
    </div>
  )
}

function ItemAddModal({ kind, profiles, onClose, onSaved }: {
  kind: NewBusinessKind; profiles: DbProfile[]; onClose: () => void; onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const f = new FormData(e.currentTarget)
    try {
      await insertNewBusinessItem({
        kind,
        title: (f.get('title') as string).trim(),
        detail: (f.get('detail') as string).trim() || null,
        assignee_id: (f.get('assignee') as string) || null,
        due_date: (f.get('due') as string) || null,
      })
      onSaved()
    } catch { setErr('保存に失敗しました'); setBusy(false) }
  }
  return (
    <Modal title={`${KIND_LABEL[kind]}を追加`} open onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">タイトル *</label>
          <input name="title" required className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">内容</label>
          <textarea name="detail" rows={4} className="input resize-y" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">担当</label>
            <select name="assignee" className="input">
              <option value="">未定</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">期限</label>
            <input name="due" type="date" className="input" />
          </div>
        </div>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>キャンセル</button>
          <button type="submit" disabled={busy} className="btn-primary text-sm">{busy ? '保存中...' : '保存'}</button>
        </div>
      </form>
    </Modal>
  )
}

function ItemDetailModal({ item, profiles, onClose, onSaved }: {
  item: DbNewBusinessItem; profiles: DbProfile[]; onClose: () => void; onSaved: () => void
}) {
  const [title, setTitle] = useState(item.title)
  const [detail, setDetail] = useState(item.detail ?? '')
  const [assignee, setAssignee] = useState(item.assignee_id ?? '')
  const [due, setDue] = useState(item.due_date ?? '')
  const [conclusion, setConclusion] = useState(item.conclusion ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setBusy(true)
    try {
      await updateNewBusinessItem(item.id, {
        title: title.trim(), detail: detail.trim() || null, assignee_id: assignee || null,
        due_date: due || null, conclusion: conclusion.trim() || null,
      })
      onSaved()
    } catch { setErr('保存に失敗しました'); setBusy(false) }
  }
  const remove = async () => {
    if (!confirm('削除しますか？')) return
    setBusy(true)
    try { await deleteNewBusinessItem(item.id); onSaved() } catch { setErr('削除に失敗しました'); setBusy(false) }
  }
  return (
    <Modal title={KIND_LABEL[item.kind]} open onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">タイトル</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">内容</label>
          <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={4} className="input resize-y" />
        </div>
        {item.kind === 'decision' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">結論（決まったら記入し、状態を「決定」に）</label>
            <textarea value={conclusion} onChange={e => setConclusion(e.target.value)} rows={3} className="input resize-y" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">担当</label>
            <select value={assignee} onChange={e => setAssignee(e.target.value)} className="input">
              <option value="">未定</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">期限</label>
            <input type="date" value={due} onChange={e => setDue(e.target.value)} className="input" />
          </div>
        </div>
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
