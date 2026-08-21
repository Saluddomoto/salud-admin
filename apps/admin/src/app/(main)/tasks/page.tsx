'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import {
  fetchTasks, fetchDraftTasks, fetchProjects, fetchProfiles, fetchMyProfile,
  insertTask, updateTask, approveDraftTask, dismissDraftTask, updateTaskStatus, deleteTask,
  fetchTaskCompletions, setTaskCompletion,
  formatDate, type DbTask, type DbProject, type DbProfile, type DbTaskCompletion,
} from '@/lib/db'

function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

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

// カード表示順: 優先度の高いタスクが上に来るように（同優先度内は元の並び=期限順を維持）
const PRIORITY_RANK = { high: 2, medium: 1, low: 0 } as const

// 担当者名から決定的に色を割り当てる（DBに色は持たせず、名前のハッシュ値でパレットを選ぶ）
const ASSIGNEE_COLORS = [
  { bar: 'border-l-sky-400',     dot: 'bg-sky-500',     text: 'text-sky-700' },
  { bar: 'border-l-emerald-400', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  { bar: 'border-l-amber-400',   dot: 'bg-amber-500',   text: 'text-amber-700' },
  { bar: 'border-l-rose-400',    dot: 'bg-rose-500',    text: 'text-rose-700' },
  { bar: 'border-l-violet-400',  dot: 'bg-violet-500',  text: 'text-violet-700' },
  { bar: 'border-l-cyan-400',    dot: 'bg-cyan-500',    text: 'text-cyan-700' },
  { bar: 'border-l-fuchsia-400', dot: 'bg-fuchsia-500', text: 'text-fuchsia-700' },
  { bar: 'border-l-lime-500',    dot: 'bg-lime-500',    text: 'text-lime-700' },
] as const

function assigneeColor(name: string | null | undefined) {
  const fallback = { bar: 'border-l-slate-200', dot: 'bg-slate-300', text: 'text-slate-400' }
  if (!name) return fallback
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return ASSIGNEE_COLORS[hash % ASSIGNEE_COLORS.length] ?? fallback
}

export default function TasksPage() {
  const [tasks,      setTasks]      = useState<DbTask[]>([])
  const [drafts,     setDrafts]     = useState<DbTask[]>([])
  const [projects,   setProjects]   = useState<DbProject[]>([])
  const [me,         setMe]         = useState<DbProfile | null>(null)
  const [members,    setMembers]    = useState<DbProfile[]>([])
  const [assignee,   setAssignee]   = useState('') // '' = 全員
  const [loading,    setLoading]    = useState(true)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editingTask, setEditingTask] = useState<DbTask | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [notice,     setNotice]     = useState('')
  const [isRoutineForm, setIsRoutineForm] = useState(false)
  const [todayCompletions, setTodayCompletions] = useState<DbTaskCompletion[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const today = toISODate(new Date())

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const canAssignOthers = me?.role === 'admin' || me?.role === 'manager'
  const isDraft = (t: DbTask) => t.source === 'ai_line' && !t.reviewed_at

  const openCreate = () => { setEditingTask(null); setIsRoutineForm(false); setModalOpen(true) }
  const openEdit = (t: DbTask) => { setEditingTask(t); setIsRoutineForm(t.is_routine); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditingTask(null) }

  // 下書き(承認待ち)は誰でも内容確認のうえ承認できる。それ以外は担当者本人か管理者/マネージャーのみ編集可
  const canEditTask = (t: DbTask) => isDraft(t) || canAssignOthers || t.assigned_user_id === me?.id
  const canDeleteTask = (t: DbTask) => canAssignOthers || (t.status === 'done' && (t.assigned_user_id === me?.id))

  const load = () => {
    Promise.all([
      fetchTasks(), fetchDraftTasks(), fetchProjects(), fetchMyProfile(),
      fetchTaskCompletions(today).catch(() => []), // task_completions 未マイグレーションでも壊れないように
    ])
      .then(([t, d, p, mine, c]) => { setTasks(t); setDrafts(d); setProjects(p); setMe(mine); setTodayCompletions(c) })
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
    const is_routine    = f.get('is_routine') === 'on'
    const due_date      = is_routine ? null : (f.get('due_date') as string) || null
    const assignedTo   = canAssignOthers ? (f.get('assigned_user_id') as string) : undefined
    // 再通知が煩雑にならないよう、LINE通知は新規作成時のみ
    const shouldNotify = !editingTask && canAssignOthers && f.get('notify') === 'on' && assignedTo && assignedTo !== me?.id

    const payload = {
      title,
      description: (f.get('description') as string)?.trim() || null,
      priority:   f.get('priority') as string,
      due_date,
      is_routine,
      project_id: (f.get('project_id') as string) || null,
      assigned_user_id: assignedTo || undefined,
    }

    try {
      if (editingTask && isDraft(editingTask)) {
        await approveDraftTask(editingTask.id, payload)
      } else if (editingTask) {
        await updateTask(editingTask.id, payload)
      } else {
        await insertTask(payload)
      }
      closeModal()
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

  const routineTasks = visibleTasks.filter(t => t.is_routine)
  const kanbanTasks = visibleTasks.filter(t => !t.is_routine)
  const completedTodayIds = new Set(todayCompletions.map(c => c.task_id))
  const routineDoneCount = routineTasks.filter(t => completedTodayIds.has(t.id)).length
  const doneCount = kanbanTasks.filter(t => t.status === 'done').length + routineDoneCount

  const toggleRoutineCompletion = async (taskId: string) => {
    const wasDone = completedTodayIds.has(taskId)
    setTodayCompletions(prev => wasDone ? prev.filter(c => c.task_id !== taskId) : [...prev, { id: `optimistic-${taskId}`, task_id: taskId, completed_on: today, completed_by: me?.id ?? null }])
    try {
      await setTaskCompletion(taskId, today, !wasDone)
    } catch {
      setError('完了状態の更新に失敗しました')
      load()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このタスクを削除しますか？')) return
    setTasks(prev => prev.filter(t => t.id !== id))
    closeModal()
    try {
      await deleteTask(id)
    } catch {
      setError('削除に失敗しました')
      load()
    }
  }

  const handleDismissDraft = async (id: string) => {
    if (!confirm('このタスク候補を却下しますか？')) return
    setDrafts(prev => prev.filter(t => t.id !== id))
    closeModal()
    try {
      await dismissDraftTask(id)
    } catch {
      setError('却下に失敗しました')
      load()
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="タスク管理" description={`${doneCount}/${kanbanTasks.length + routineTasks.length} 件完了`}>
        {assigneeOptions.length > 0 && (
          <select className="input w-32 text-sm" value={assignee} onChange={e => setAssignee(e.target.value)}>
            <option value="">全員</option>
            {assigneeOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <button className="btn-primary text-sm" onClick={openCreate}>+ タスクを追加</button>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}
      {notice && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">{notice}</div>
      )}

      {assigneeOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {assigneeOptions.map(name => {
            const c = assigneeColor(name)
            return (
              <span key={name} className="inline-flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                {name}
              </span>
            )
          })}
        </div>
      )}

      {routineTasks.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            🔁 ルーティン（毎日）— {routineDoneCount}/{routineTasks.length} 件完了
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {routineTasks.map(t => {
              const done = completedTodayIds.has(t.id)
              const editable = canEditTask(t)
              return (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-100 p-3 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggleRoutineCompletion(t.id)}
                    className="mt-0.5 rounded border-slate-300 text-brand-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                      {t.title}
                    </span>
                    <span className="text-xs text-slate-400">{t.profiles?.full_name ?? '—'}</span>
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); openEdit(t) }}
                      className="flex-shrink-0 text-xs font-medium text-brand-600 hover:underline"
                    >編集</button>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
            🤖 LINEグループから検出したタスク候補（{drafts.length}件・要確認）
          </h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {drafts.map(t => (
              <div key={t.id} className="card p-3.5">
                <p className="text-sm font-medium leading-snug text-slate-900">{t.title}</p>
                {t.description && (
                  <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-500">{t.description}</p>
                )}
                {t.due_date && <p className="mt-1.5 text-xs text-slate-400">〆 {formatDate(t.due_date)}</p>}
                <div className="mt-3 flex gap-2 border-t border-slate-50 pt-2.5">
                  <button className="btn-primary flex-1 text-xs" onClick={() => openEdit(t)}>内容を確認して承認</button>
                  <button
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-rose-500 hover:bg-rose-50"
                    onClick={() => handleDismissDraft(t.id)}
                  >却下</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
        {COLUMNS.map((col, colIdx) => {
          const items = kanbanTasks
            .filter(t => t.status === col.key)
            .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])
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
                  const editable = canEditTask(t)
                  const ac = assigneeColor(t.profiles?.full_name)
                  const isExpanded = expandedIds.has(t.id)
                  return (
                    <div
                      key={t.id}
                      onClick={() => editable && openEdit(t)}
                      className={`card border-l-4 ${ac.bar} p-2.5 transition-shadow hover:shadow-md ${editable ? 'cursor-pointer' : ''}`}
                      title={editable ? 'クリックして編集' : undefined}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={`min-w-0 truncate text-sm font-medium ${t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                          {t.title}
                        </p>
                        <button
                          onClick={e => { e.stopPropagation(); toggleExpanded(t.id) }}
                          title={isExpanded ? '閉じる' : '詳細を表示'}
                          className="flex-shrink-0 rounded p-0.5 text-xs text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                        >
                          {isExpanded ? '▲' : '▾'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 space-y-1.5 border-t border-slate-50 pt-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`inline-flex min-w-0 items-center gap-1 text-xs font-medium ${ac.text}`}>
                              <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${ac.dot}`} />
                              <span className="truncate">{t.profiles?.full_name ?? '—'}</span>
                            </span>
                            <span className={`badge flex-shrink-0 text-xs ${pr.cls}`}>{pr.label}</span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {t.projects?.title ? `${t.projects.title} ・ ` : ''}〆{formatDate(t.due_date)}
                          </div>
                          {t.description && (
                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-500">{t.description}</p>
                          )}
                          <div className="flex justify-end gap-1 pt-0.5" onClick={e => e.stopPropagation()}>
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
                            {canDeleteTask(t) && (
                              <button
                                onClick={() => handleDelete(t.id)}
                                title="削除"
                                className="rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-rose-500 hover:bg-rose-50"
                              >×</button>
                            )}
                          </div>
                        </div>
                      )}
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

      <Modal
        title={editingTask ? (isDraft(editingTask) ? 'タスク候補を確認' : 'タスクを編集') : 'タスクを追加'}
        open={modalOpen}
        onClose={closeModal}
      >
        <form key={editingTask?.id ?? 'new'} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">タスク名 *</label>
            <input name="title" required className="input" placeholder="申請書類の確認" defaultValue={editingTask?.title ?? ''} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">内容・メモ</label>
            <textarea
              name="description"
              rows={3}
              className="input resize-y"
              placeholder="作業の詳細や手順、チェック項目など（任意）"
              defaultValue={editingTask?.description ?? ''}
            />
          </div>
          {canAssignOthers && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">担当者</label>
              <select name="assigned_user_id" className="input" defaultValue={editingTask?.assigned_user_id ?? me?.id}>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.full_name}{m.id === me?.id ? '（自分）' : ''}</option>
                ))}
              </select>
              {!editingTask && (
                <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" name="notify" defaultChecked className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600" />
                  本人にLINEで通知する（自分宛の場合は送信されません）
                </label>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">優先度</label>
              <select name="priority" className="input" defaultValue={editingTask?.priority ?? 'medium'}>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">期限</label>
              <input
                name="due_date" type="date" className="input" disabled={isRoutineForm}
                defaultValue={editingTask?.due_date ?? ''}
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
            <input
              type="checkbox" name="is_routine" checked={isRoutineForm}
              onChange={e => setIsRoutineForm(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600"
            />
            ルーティン（毎日のタスク・期限を設定しない。ダッシュボードとタスク管理に毎日表示され、完了は日ごとにリセットされます）
          </label>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">関連案件</label>
            <select name="project_id" className="input" defaultValue={editingTask?.project_id ?? ''}>
              <option value="">なし</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
            {editingTask && isDraft(editingTask) ? (
              <button type="button" className="text-sm font-medium text-rose-600 hover:underline" onClick={() => handleDismissDraft(editingTask.id)}>
                このタスク候補を却下
              </button>
            ) : editingTask && canDeleteTask(editingTask) ? (
              <button type="button" className="text-sm font-medium text-rose-600 hover:underline" onClick={() => handleDelete(editingTask.id)}>
                このタスクを削除
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={closeModal}>キャンセル</button>
              <button type="submit" disabled={saving} className="btn-primary text-sm">
                {saving ? '保存中...' : (editingTask && isDraft(editingTask) ? '承認してタスク化' : '保存')}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
