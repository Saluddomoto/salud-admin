'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { DocumentsCard } from '@/components/DocumentsCard'
import {
  deleteProject, fetchProject, fetchTasksByProject, insertTask,
  updateProject, updateProjectStatus, updateTaskStatus,
  formatAmount, type DbProject, type DbTask,
} from '@/lib/db'

const STATUSES: { key: DbProject['status']; label: string; cls: string }[] = [
  { key: 'planning',    label: '準備中',     cls: 'bg-slate-100 text-slate-600' },
  { key: 'in_progress', label: '申請準備中', cls: 'bg-amber-100 text-amber-700' },
  { key: 'submitted',   label: '申請済み',   cls: 'bg-indigo-100 text-indigo-700' },
  { key: 'accepted',    label: '採択',       cls: 'bg-emerald-100 text-emerald-700' },
  { key: 'rejected',    label: '不採択',     cls: 'bg-rose-100 text-rose-700' },
  { key: 'completed',   label: '完了',       cls: 'bg-slate-100 text-slate-500' },
]

const SUBSIDY_NAMES = [
  '省力化投資補助金',
  '小規模事業者持続化補助金',
  '新事業進出・ものづくり補助金',
  'デジタル化・AI導入補助金',
  '成長加速化補助金',
  '事業承継・M&A補助金',
]

const BASE_FEE_OPTIONS = [100_000, 120_000, 150_000]
const SUCCESS_FEE_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15]

const PRIORITY_META: Record<DbTask['priority'], { label: string; cls: string }> = {
  high:   { label: '高', cls: 'bg-rose-100 text-rose-700' },
  medium: { label: '中', cls: 'bg-amber-100 text-amber-700' },
  low:    { label: '低', cls: 'bg-slate-100 text-slate-500' },
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project,  setProject]  = useState<DbProject | null>(null)
  const [tasks,    setTasks]    = useState<DbTask[]>([])
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error,    setError]    = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [subsidyChoice, setSubsidyChoice] = useState('')

  const load = useCallback(() => {
    Promise.all([fetchProject(id), fetchTasksByProject(id)])
      .then(([p, t]) => {
        if (!p) setNotFound(true)
        setProject(p)
        setTasks(t)
      })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(load, [load])

  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const f = new FormData(e.currentTarget)
    const subsidyName = subsidyChoice === '__other__' ? (f.get('subsidy_name_other') as string) : subsidyChoice
    try {
      await updateProject(id, {
        title:             f.get('title') as string,
        subsidy_name:      subsidyName,
        applied_amount:    f.get('amount') ? Number(f.get('amount')) * 10_000 : null,
        subsidy_amount:    f.get('subsidy_amount') ? Number(f.get('subsidy_amount')) * 10_000 : null,
        base_fee:          f.get('base_fee') ? Number(f.get('base_fee')) : null,
        success_fee_rate:  f.get('success_fee_rate') ? Number(f.get('success_fee_rate')) : null,
        deadline:          (f.get('deadline') as string) || null,
        notes:             (f.get('notes') as string) || null,
      })
      setEditOpen(false)
      load()
    } catch {
      setError('保存に失敗しました（権限がない可能性があります）')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    if (!project) return
    const prev = project.status
    setProject({ ...project, status: status as DbProject['status'] })
    try {
      await updateProjectStatus(id, status)
    } catch {
      setProject(p => p ? { ...p, status: prev } : p)
      setError('ステータスの更新に失敗しました')
    }
  }

  const handleAddTask = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const f = new FormData(e.currentTarget)
    try {
      await insertTask({
        title:      f.get('title') as string,
        priority:   f.get('priority') as string,
        due_date:   (f.get('due_date') as string) || null,
        project_id: id,
      })
      setTaskOpen(false)
      load()
    } catch {
      setError('タスクの追加に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const toggleTask = async (t: DbTask) => {
    const next = t.status === 'done' ? 'todo' : 'done'
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x))
    try {
      await updateTaskStatus(t.id, next)
    } catch {
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: t.status } : x))
      setError('タスクの更新に失敗しました')
    }
  }

  const handleDelete = async () => {
    if (!confirm(`「${project?.title}」を削除しますか？\n紐づくタスクは残ります（案件との関連は外れます）。この操作は取り消せません。`)) return
    try {
      await deleteProject(id)
      router.push('/projects')
    } catch {
      setError('削除に失敗しました（権限がない可能性があります）')
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">読み込み中...</div>
  }

  if (notFound || !project) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <p className="text-sm text-slate-500">案件が見つかりませんでした（削除されたか、閲覧権限がありません）。</p>
        <Link href="/projects" className="text-sm font-medium text-brand-600 hover:underline">← 案件一覧へ戻る</Link>
      </div>
    )
  }

  const doneCount = tasks.filter(t => t.status === 'done').length

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link href="/projects" className="text-xs font-medium text-slate-400 hover:text-brand-600">← 案件管理</Link>
        <div className="mt-1">
          <PageHeader title={project.title} description={project.subsidy_name}>
            <select
              className="input w-36 text-sm"
              value={project.status}
              onChange={e => handleStatusChange(e.target.value)}
            >
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button
              className="btn-secondary text-sm"
              onClick={() => {
                setSubsidyChoice(SUBSIDY_NAMES.includes(project.subsidy_name) ? project.subsidy_name : '__other__')
                setEditOpen(true)
              }}
            >編集</button>
            <button
              className="rounded-xl border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
              onClick={handleDelete}
            >
              削除
            </button>
          </PageHeader>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.5fr]">
        {/* 案件情報 */}
        <div className="card p-5">
          <h3 className="mb-4 font-semibold text-slate-900">案件情報</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex gap-3">
              <dt className="w-20 flex-shrink-0 text-slate-400">顧客</dt>
              <dd>
                <Link href={`/customers/${project.customer_id}`} className="font-medium text-brand-600 hover:underline">
                  {project.customers?.company_name ?? '—'}
                </Link>
              </dd>
            </div>
            {[
              { label: '補助金',     value: project.subsidy_name },
              { label: '申請額',     value: formatAmount(project.applied_amount) },
              { label: '採択額',     value: formatAmount(project.subsidy_amount) },
              { label: '基本料金',   value: formatAmount(project.base_fee) },
              { label: '成功報酬',   value: project.success_fee_rate != null ? `${project.success_fee_rate}%` : '—' },
              { label: '申請期限',   value: project.deadline ?? '—' },
              { label: '社内担当',   value: project.profiles?.full_name ?? '—' },
            ].map(row => (
              <div key={row.label} className="flex gap-3">
                <dt className="w-20 flex-shrink-0 text-slate-400">{row.label}</dt>
                <dd className="text-slate-700">{row.value}</dd>
              </div>
            ))}
          </dl>
          {project.notes && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-1 text-xs text-slate-400">メモ</p>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{project.notes}</p>
            </div>
          )}
        </div>

        {/* タスク */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              タスク
              {tasks.length > 0 && <span className="ml-2 text-xs font-normal text-slate-400">{doneCount}/{tasks.length} 完了</span>}
            </h3>
            <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setTaskOpen(true)}>
              + タスクを追加
            </button>
          </div>
          {tasks.length > 0 && (
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%` }}
              />
            </div>
          )}
          <div className="space-y-1">
            {tasks.map(t => {
              const done = t.status === 'done'
              const pr = PRIORITY_META[t.priority]
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggleTask(t)}
                    className="rounded border-slate-300 text-brand-600"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {t.title}
                    </p>
                    <p className={`text-xs ${done ? 'text-slate-300' : 'text-slate-400'}`}>
                      期限 {t.due_date ?? '—'} · {t.profiles?.full_name ?? '—'}
                    </p>
                  </div>
                  <span className={`badge flex-shrink-0 text-xs ${pr.cls}`}>{pr.label}</span>
                </div>
              )
            })}
            {tasks.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400">タスクはまだありません</p>
            )}
          </div>
        </div>
      </div>

      {/* 資料 */}
      <DocumentsCard parent={{ projectId: id }} />

      {/* 編集モーダル */}
      <Modal title="案件を編集" open={editOpen} onClose={() => setEditOpen(false)}>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">案件名 *</label>
            <input name="title" required className="input" defaultValue={project.title} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">補助金名 *</label>
              <select className="input" value={subsidyChoice} onChange={e => setSubsidyChoice(e.target.value)}>
                {SUBSIDY_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                <option value="__other__">その他（自由入力）</option>
              </select>
              {subsidyChoice === '__other__' && (
                <input
                  name="subsidy_name_other" required className="input mt-2"
                  defaultValue={SUBSIDY_NAMES.includes(project.subsidy_name) ? '' : project.subsidy_name}
                  placeholder="補助金名を入力"
                />
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">申請額（万円）</label>
              <input
                name="amount" type="number" className="input"
                defaultValue={project.applied_amount != null ? project.applied_amount / 10_000 : ''}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">採択額（万円）</label>
              <input
                name="subsidy_amount" type="number" className="input"
                defaultValue={project.subsidy_amount != null ? project.subsidy_amount / 10_000 : ''}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">基本料金</label>
              <select name="base_fee" className="input" defaultValue={project.base_fee ?? ''}>
                <option value="">未設定</option>
                {BASE_FEE_OPTIONS.map(v => <option key={v} value={v}>{(v / 10_000).toFixed(0)}万円</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">成功報酬</label>
              <select name="success_fee_rate" className="input" defaultValue={project.success_fee_rate ?? ''}>
                <option value="">未設定</option>
                {SUCCESS_FEE_OPTIONS.map(v => <option key={v} value={v}>{v}%</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">申請期限</label>
              <input name="deadline" type="date" className="input" defaultValue={project.deadline ?? ''} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">メモ</label>
            <textarea name="notes" rows={3} className="input" defaultValue={project.notes ?? ''} />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary text-sm" onClick={() => setEditOpen(false)}>キャンセル</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>

      {/* タスク追加モーダル */}
      <Modal title="タスクを追加" open={taskOpen} onClose={() => setTaskOpen(false)}>
        <form onSubmit={handleAddTask} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">タスク名 *</label>
            <input name="title" required className="input" placeholder="申請書類の最終確認" />
          </div>
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
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary text-sm" onClick={() => setTaskOpen(false)}>キャンセル</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? '保存中...' : '追加'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
