'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import {
  fetchTasks, fetchProjects, fetchProfiles, fetchMyProfile, insertTask, updateTaskStatus,
  formatDate, type DbTask, type DbProject, type DbProfile,
} from '@/lib/db'

const COLUMNS = [
  { key: 'todo',        label: '未着手', dot: 'bg-slate-400' },
  { key: 'in_progress', label: '進行中', dot: 'bg-amber-500' },
  { key: 'done',        label: '完了',   dot: 'bg-emerald-500' },
] as const

const PRIORITY_META = {
  high:   { label: '高', cls: 'bg-rose-100 text-rose-700' },
  medium: { label: '中', cls: 'bg-amber-100 text-amber-700' },
  low:    { label: '低', cls: 'bg-slate-100 text-slate-500' },
} as const

export default function TasksPage() {
  const [tasks,     setTasks]     = useState<DbTask[]>([])
  const [projects,  setProjects]  = useState<DbProject[]>([])
  const [me,        setMe]        = useState<DbProfile | null>(null)
  const [members,   setMembers]   = useState<DbProfile[]>([])
  const [assignee,  setAssignee]  = useState('') // '' = 全員
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [notice,    setNotice]    = useState('')

  const canAssignOthers = me?.role === 'admin' || me?.role === 'manager'

  const load = () => {
    Promise.all([fetchTasks(), fetchProjects(), fetchMyProfile()])
      .then(([t, p, mine]) => { setTasks(t); setProjects(p); setMe(mine) })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  useEffect(() => {
    if (canAssignOthers) fetchProfiles().then(setMembers).catch(() => {})
  }, [canAssignOthers])

  // 担当者ごとの画面切替（見えているタスクの範囲内で候補を作る = RLS で自然に絞られる）
  const assigneeOptions = useMemo(
    () => [...new Set(tasks.map(t => t.profiles?.full_name).filter(Boolean))] as string[],
    [tasks],
  )
  const visibleTasks = assignee ? tasks.filter(t => t.profiles?.full_name === assignee) : tasks

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    const f = new FormData(e.currentTarget)
    const title        = f.get('title') as string
    const due_date      = (f.get('due_date') as string) || null
    const assignedTo   = canAssignOthers ? (f.get('assigned_user_id') as string) : undefined
    const shouldNotify = canAssignOthers && f.get('notify') === 'on' && assignedTo && assignedTo !== me?.id

    try {
      await insertTask({
        title,
        priority:   f.get('priority') as string,
        due_date,
        project_id: (f.get('project_id') as string) || null,
        assigned_user_id: assignedTo || undefined,
      })
      setModalOpen(false)
      load()

      if (shouldNotify) {
        const res = await fetch('/api/admin/notify-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigned_user_id: assignedTo, title, due_date }),
        }).then(r => r.json()).catch(() => null)
        setNotice(
          res?.notified ? 'LINEで本人に通知しました'
          : res?.reason === 'LINE未登録' ? '担当者がLINE未登録のため通知は送れませんでした'
          : '通知の送信に失敗しました（タスクは作成済みです）',
        )
      }
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const moveStatus = async (id: string, status: DbTask['status']) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    try {
      await updateTaskStatus(id, status)
    } catch {
      setError('ステータスの更新に失敗しました')
      load()
    }
  }

  const doneCount = visibleTasks.filter(t => t.status === 'done').length

  return (
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="タスク管理" description={`${doneCount}/${visibleTasks.length} 件完了`}>
        {assigneeOptions.length > 0 && (
          <select className="input w-32 text-sm" value={assignee} onChange={e => setAssignee(e.target.value)}>
            <option value="">全員</option>
            {assigneeOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>+ タスクを追加</button>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}
      {notice && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">{notice}</div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
        {COLUMNS.map((col, colIdx) => {
          const items = visibleTasks.filter(t => t.status === col.key)
          return (
            <div key={col.key} className="flex flex-col rounded-2xl bg-slate-50/80 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {items.map(t => {
                  const pr = PRIORITY_META[t.priority]
                  return (
                    <div key={t.id} className="card p-3.5 transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium leading-snug ${t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                          {t.title}
                        </p>
                        <span className={`badge flex-shrink-0 text-xs ${pr.cls}`}>{pr.label}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">{t.projects?.title ?? '—'}</p>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-2.5">
                        <span className="text-xs text-slate-500">
                          {t.profiles?.full_name ?? '—'} · 〆 {formatDate(t.due_date)}
                        </span>
                        <div className="flex gap-1">
                          {colIdx > 0 && (
                            <button
                              onClick={() => moveStatus(t.id, COLUMNS[colIdx - 1]!.key)}
                              title={`${COLUMNS[colIdx - 1]!.label}に戻す`}
                              className="rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-50"
                            >←</button>
                          )}
                          {colIdx < COLUMNS.length - 1 && (
                            <button
                              onClick={() => moveStatus(t.id, COLUMNS[colIdx + 1]!.key)}
                              title={`${COLUMNS[colIdx + 1]!.label}へ進める`}
                              className="rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-50"
                            >→</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {!loading && items.length === 0 && (
                  <p className="py-8 text-center text-xs text-slate-300">タスクなし</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Modal title="タスクを追加" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">タスク名 *</label>
            <input name="title" required className="input" placeholder="申請書類の確認" />
          </div>
          {canAssignOthers && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">担当者</label>
              <select name="assigned_user_id" className="input" defaultValue={me?.id}>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.full_name}{m.id === me?.id ? '（自分）' : ''}</option>
                ))}
              </select>
              <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
                <input type="checkbox" name="notify" defaultChecked className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600" />
                本人にLINEで通知する（自分宛の場合は送信されません）
              </label>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">優先度</label>
              <select name="priority" className="input" defaultValue="medium">
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">期限</label>
              <input name="due_date" type="date" className="input" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">関連案件</label>
            <select name="project_id" className="input">
              <option value="">なし</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary text-sm" onClick={() => setModalOpen(false)}>キャンセル</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
