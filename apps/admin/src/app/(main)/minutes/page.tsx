'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchMeetingNotes, insertMeetingNote, updateMeetingNote, deleteMeetingNote,
  fetchCustomers, fetchProjects,
  type DbMeetingNote, type DbCustomer, type DbProject,
} from '@/lib/db'

function formatMeetingDate(iso: string | null): string {
  if (!iso) return '日時未設定'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const SOURCE_META = {
  zoom:   { label: 'Zoom', cls: 'bg-blue-100 text-blue-700' },
  manual: { label: '手動', cls: 'bg-slate-100 text-slate-600' },
} as const

export default function MinutesPage() {
  const { role } = useAuth()
  const canDelete = role === 'admin' || role === 'manager'

  const [notes,     setNotes]     = useState<DbMeetingNote[]>([])
  const [customers, setCustomers] = useState<DbCustomer[]>([])
  const [projects,  setProjects]  = useState<DbProject[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  const [addOpen,  setAddOpen]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [detail,   setDetail]   = useState<DbMeetingNote | null>(null)

  const load = () => {
    Promise.all([fetchMeetingNotes(), fetchCustomers(), fetchProjects()])
      .then(([n, c, p]) => { setNotes(n); setCustomers(c); setProjects(p) })
      .catch(() => setError('議事録の取得に失敗しました'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const zoomCount = useMemo(() => notes.filter(n => n.source === 'zoom').length, [notes])

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const f = new FormData(e.currentTarget)
    try {
      await insertMeetingNote({
        title:         (f.get('title') as string) || '(無題の会議)',
        meeting_date:  (f.get('meeting_date') as string) || null,
        recording_url: (f.get('recording_url') as string)?.trim() || null,
        transcript:    (f.get('transcript') as string)?.trim() || null,
        summary:       (f.get('summary') as string)?.trim() || null,
        customer_id:   (f.get('customer_id') as string) || null,
        project_id:    (f.get('project_id') as string) || null,
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
      <PageHeader title="議事録" description={`社内MTG・Zoom連携（Zoom取込 ${zoomCount} 件）`}>
        <button className="btn-primary text-sm" onClick={() => setAddOpen(true)}>+ 議事録を追加</button>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="flex flex-col gap-2.5">
        {loading && <p className="p-12 text-center text-sm text-slate-400">読み込み中...</p>}

        {!loading && notes.map(n => (
          <button
            key={n.id}
            onClick={() => setDetail(n)}
            className="card flex items-start gap-4 p-4 text-left transition-shadow hover:shadow-md"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge text-xs ${SOURCE_META[n.source].cls}`}>{SOURCE_META[n.source].label}</span>
                <p className="text-sm font-semibold text-slate-900">{n.title}</p>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {formatMeetingDate(n.meeting_date)}
                {n.duration_min ? ` · ${n.duration_min}分` : ''}
                {n.host_name ? ` · ${n.host_name}` : ''}
              </p>
              {(n.customers || n.projects) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {n.customers && <span className="badge bg-brand-50 text-xs text-brand-700">{n.customers.company_name}</span>}
                  {n.projects && <span className="badge bg-indigo-50 text-xs text-indigo-700">{n.projects.title}</span>}
                </div>
              )}
              {(n.summary || n.transcript) && (
                <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{n.summary || n.transcript}</p>
              )}
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
              {n.transcript && <span className="badge bg-emerald-50 text-xs text-emerald-700">文字起こし有</span>}
              {n.recording_url && <span className="text-xs text-slate-300">録画リンク有</span>}
            </div>
          </button>
        ))}

        {!loading && notes.length === 0 && (
          <div className="card p-12 text-center text-sm text-slate-400">
            議事録がまだありません。Zoomのクラウド録画が完了すると自動で追加されます。<br />
            手動で残す場合は「＋議事録を追加」からどうぞ。
          </div>
        )}
      </div>

      {/* 追加モーダル */}
      <Modal title="議事録を追加" open={addOpen} onClose={() => setAddOpen(false)}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">会議名 *</label>
            <input name="title" required className="input" placeholder="週次定例MTG" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">日時</label>
              <input name="meeting_date" type="datetime-local" className="input" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">録画/共有リンク</label>
              <input name="recording_url" type="url" className="input" placeholder="https://zoom.us/rec/..." />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">関連顧客</label>
              <select name="customer_id" className="input">
                <option value="">なし</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">関連案件</label>
              <select name="project_id" className="input">
                <option value="">なし</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">要約・決定事項</label>
            <textarea name="summary" rows={3} className="input resize-y" placeholder="決まったこと・ToDoなど" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">議事録・文字起こし</label>
            <textarea name="transcript" rows={5} className="input resize-y" placeholder="Zoomの文字起こしを貼り付け、または議事メモを記入" />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary text-sm" onClick={() => setAddOpen(false)}>キャンセル</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </Modal>

      {/* 詳細モーダル */}
      {detail && (
        <DetailModal
          note={detail}
          customers={customers}
          projects={projects}
          canDelete={canDelete}
          onClose={() => setDetail(null)}
          onSaved={() => { setDetail(null); load() }}
        />
      )}
    </div>
  )
}

function DetailModal({ note, customers, projects, canDelete, onClose, onSaved }: {
  note: DbMeetingNote
  customers: DbCustomer[]
  projects: DbProject[]
  canDelete: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [title,      setTitle]      = useState(note.title)
  const [summary,    setSummary]    = useState(note.summary ?? '')
  const [customerId, setCustomerId] = useState(note.customer_id ?? '')
  const [projectId,  setProjectId]  = useState(note.project_id ?? '')
  const [busy,       setBusy]       = useState(false)
  const [err,        setErr]        = useState('')

  const save = async () => {
    setBusy(true)
    setErr('')
    try {
      await updateMeetingNote(note.id, {
        title,
        summary:     summary.trim() || null,
        customer_id: customerId || null,
        project_id:  projectId || null,
      })
      onSaved()
    } catch {
      setErr('保存に失敗しました')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('この議事録を削除しますか？')) return
    setBusy(true)
    try {
      await deleteMeetingNote(note.id)
      onSaved()
    } catch {
      setErr('削除に失敗しました')
      setBusy(false)
    }
  }

  return (
    <Modal title="議事録" open onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">会議名</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input" />
          <p className="mt-1 text-xs text-slate-400">
            {formatMeetingDate(note.meeting_date)}
            {note.duration_min ? ` · ${note.duration_min}分` : ''}
            {note.host_name ? ` · ${note.host_name}` : ''}
          </p>
        </div>

        {note.recording_url && (
          <a href={note.recording_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
            ▶ Zoom録画を開く
          </a>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">関連顧客</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="input">
              <option value="">なし</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">関連案件</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className="input">
              <option value="">なし</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">要約・決定事項</label>
          <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
            className="input resize-y" placeholder="決まったこと・ToDoなど" />
        </div>

        {note.transcript && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">文字起こし</label>
            <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              {note.transcript}
            </div>
          </div>
        )}

        {err && <p className="text-sm text-rose-600">{err}</p>}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          {canDelete
            ? <button onClick={remove} disabled={busy} className="text-sm text-rose-500 hover:text-rose-600">削除</button>
            : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">閉じる</button>
            <button onClick={save} disabled={busy} className="btn-primary text-sm">{busy ? '保存中...' : '保存'}</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
