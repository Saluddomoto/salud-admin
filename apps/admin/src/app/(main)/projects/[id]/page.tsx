'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { DocumentsCard } from '@/components/DocumentsCard'
import { TaxAmountInput } from '@/components/TaxAmountInput'
import { useAuth } from '@/hooks/useAuth'
import {
  deleteProject, fetchProject, fetchTasksByProject, fetchCustomers, fetchProfiles, insertTask,
  updateProject, updateProjectStatus, updateTaskStatus,
  formatAmount, type DbProject, type DbTask, type DbCustomer, type DbProfile,
} from '@/lib/db'

const STATUSES: { key: DbProject['status']; label: string; cls: string }[] = [
  { key: 'planning',    label: '見込み',     cls: 'bg-slate-100 text-slate-600' },
  { key: 'in_progress', label: '申請準備中', cls: 'bg-amber-100 text-amber-700' },
  { key: 'submitted',   label: '申請済み',   cls: 'bg-indigo-100 text-indigo-700' },
  { key: 'accepted',    label: '採択',       cls: 'bg-emerald-100 text-emerald-700' },
  { key: 'rejected',    label: '不採択',     cls: 'bg-rose-100 text-rose-700' },
  { key: 'lost',        label: '失注',       cls: 'bg-zinc-200 text-zinc-600' },
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
  const { role } = useAuth()
  const canDelete = role === 'admin' || role === 'manager'
  const [project,  setProject]  = useState<DbProject | null>(null)
  const [tasks,    setTasks]    = useState<DbTask[]>([])
  const [customers, setCustomers] = useState<DbCustomer[]>([])
  const [members,  setMembers]  = useState<DbProfile[]>([])
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error,    setError]    = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [subsidyChoice, setSubsidyChoice] = useState('')
  const [projectType, setProjectType] = useState<'subsidy' | 'web'>('subsidy')
  const [baseFeeChoice, setBaseFeeChoice] = useState('')

  const load = useCallback(() => {
    Promise.all([fetchProject(id), fetchTasksByProject(id), fetchCustomers(), fetchProfiles()])
      .then(([p, t, c, m]) => {
        if (!p) setNotFound(true)
        setProject(p)
        setTasks(t)
        setCustomers(c)
        setMembers(m.filter(x => x.is_active))
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
    const baseFee = baseFeeChoice === '__other__'
      ? (f.get('base_fee_other') ? Number(f.get('base_fee_other')) * 10_000 : null)
      : (f.get('base_fee') ? Number(f.get('base_fee')) : null)
    try {
      await updateProject(id, {
        title:             f.get('title') as string,
        project_type:      projectType,
        subsidy_name:      projectType === 'web' ? null : subsidyName,
        customer_id:       (f.get('customer_id') as string) || null,
        applied_amount:    projectType === 'web' ? null : (f.get('amount') ? Number(f.get('amount')) * 10_000 : null),
        subsidy_amount:    projectType === 'web' ? null : (f.get('subsidy_amount') ? Number(f.get('subsidy_amount')) * 10_000 : null),
        base_fee:          projectType === 'web' ? null : baseFee,
        success_fee_rate:  projectType === 'web' ? null : (f.get('success_fee_rate') ? Number(f.get('success_fee_rate')) : null),
        web_fee_excl_tax:  projectType === 'web' ? (f.get('web_fee_excl_tax') ? Number(f.get('web_fee_excl_tax')) : null) : null,
        payment_due_date:      (f.get('payment_due_date') as string) || null,
        payment_received_date: (f.get('payment_received_date') as string) || null,
        deadline:          projectType === 'web' ? null : (f.get('deadline') as string) || null,
        result_at:         projectType === 'web' ? null : (f.get('result_at') as string) || null,
        notes:             (f.get('notes') as string) || null,
        homepage_url:      (f.get('homepage_url') as string)?.trim() || null,
        assigned_user_id:   (f.get('assigned_user_id') as string) || null,
        assigned_user_id_2: (f.get('assigned_user_id_2') as string) || null,
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
        <Link href="/projects" className="text-xs font-medium text-slate-400 hover:text-brand-600">← 案件進捗管理</Link>
        <div className="mt-1">
          <PageHeader title={project.title} description={project.project_type === 'web' ? 'WEB制作' : project.subsidy_name ?? undefined}>
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
                setSubsidyChoice(
                  project.subsidy_name && SUBSIDY_NAMES.includes(project.subsidy_name)
                    ? project.subsidy_name
                    : '__other__'
                )
                setProjectType(project.project_type)
                setBaseFeeChoice(
                  project.base_fee != null && BASE_FEE_OPTIONS.includes(project.base_fee)
                    ? String(project.base_fee)
                    : project.base_fee != null ? '__other__' : ''
                )
                setEditOpen(true)
              }}
            >編集</button>
            {canDelete && (
              <button
                className="rounded-xl border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                onClick={handleDelete}
              >
                削除
              </button>
            )}
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
                {project.customer_id ? (
                  <Link href={`/customers/${project.customer_id}`} className="font-medium text-brand-600 hover:underline">
                    {project.customers?.company_name ?? '—'}
                  </Link>
                ) : (
                  <span className="text-slate-400">未設定<span className="ml-1 text-xs">（編集から紐付け可）</span></span>
                )}
              </dd>
            </div>
            {(project.project_type === 'web' ? [
              { label: '案件区分',   value: 'WEB制作' },
              { label: '制作費',     value: project.web_fee_excl_tax != null ? `${formatAmount(project.web_fee_excl_tax)}（税抜）` : '—' },
              { label: '入金予定日', value: project.payment_due_date ?? '—' },
              { label: '入金日',     value: project.payment_received_date ?? '—' },
              { label: '社内担当',   value: [project.profiles?.full_name, project.assignee2?.full_name].filter(Boolean).join('・') || '—' },
            ] : [
              { label: '補助金',     value: project.subsidy_name ?? '—' },
              { label: '申請額',     value: formatAmount(project.applied_amount) },
              { label: '採択額',     value: formatAmount(project.subsidy_amount) },
              { label: '基本料金',   value: formatAmount(project.base_fee) },
              { label: '成功報酬',   value: project.success_fee_rate != null ? `${project.success_fee_rate}%` : '—' },
              { label: '申請期限',   value: project.deadline ?? '—' },
              { label: '採択発表日', value: project.result_at ?? '—' },
              { label: '基本料金 入金予定日', value: project.payment_due_date ?? '—' },
              { label: '基本料金 入金日',     value: project.payment_received_date ?? '—' },
              { label: '社内担当',   value: [project.profiles?.full_name, project.assignee2?.full_name].filter(Boolean).join('・') || '—' },
            ]).map(row => (
              <div key={row.label} className="flex gap-3">
                <dt className="w-20 flex-shrink-0 text-slate-400">{row.label}</dt>
                <dd className="text-slate-700">{row.value}</dd>
              </div>
            ))}
            <div className="flex gap-3">
              <dt className="w-20 flex-shrink-0 text-slate-400">HP</dt>
              <dd className="min-w-0 break-all">
                {project.homepage_url ? (
                  <a href={project.homepage_url} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
                    {project.homepage_url}
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </dd>
            </div>
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
              <label className="mb-1.5 block text-sm font-medium text-slate-700">案件区分 *</label>
              <div className="flex gap-2">
                {(['subsidy', 'web'] as const).map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => setProjectType(t)}
                    className={`flex-1 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
                      projectType === t
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {t === 'subsidy' ? '補助金' : 'WEB制作'}
                  </button>
                ))}
              </div>
            </div>
            {projectType === 'subsidy' ? (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">補助金名 *</label>
                <select className="input" value={subsidyChoice} onChange={e => setSubsidyChoice(e.target.value)}>
                  {SUBSIDY_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                  <option value="__other__">その他（自由入力）</option>
                </select>
                {subsidyChoice === '__other__' && (
                  <input
                    name="subsidy_name_other" required className="input mt-2"
                    defaultValue={project.subsidy_name && SUBSIDY_NAMES.includes(project.subsidy_name) ? '' : project.subsidy_name ?? ''}
                    placeholder="補助金名を入力"
                  />
                )}
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">顧客</label>
              <select name="customer_id" className="input" defaultValue={project.customer_id ?? ''}>
                <option value="">未設定</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">社内担当1</label>
              <select name="assigned_user_id" className="input" defaultValue={project.assigned_user_id ?? ''}>
                <option value="">未設定</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">社内担当2</label>
              <select name="assigned_user_id_2" className="input" defaultValue={project.assigned_user_id_2 ?? ''}>
                <option value="">未設定</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            {projectType === 'subsidy' ? (
              <>
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
                  <select
                    name="base_fee"
                    className="input"
                    value={baseFeeChoice}
                    onChange={e => setBaseFeeChoice(e.target.value)}
                  >
                    <option value="">未設定</option>
                    {BASE_FEE_OPTIONS.map(v => <option key={v} value={v}>{(v / 10_000).toFixed(0)}万円</option>)}
                    <option value="__other__">その他（自由入力）</option>
                  </select>
                  {baseFeeChoice === '__other__' && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        name="base_fee_other" type="number" required className="input"
                        placeholder="130"
                        defaultValue={project.base_fee != null && !BASE_FEE_OPTIONS.includes(project.base_fee) ? project.base_fee / 10_000 : ''}
                      />
                      <span className="flex-shrink-0 text-sm text-slate-500">万円</span>
                    </div>
                  )}
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
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">採択発表日</label>
                  <input name="result_at" type="date" className="input" defaultValue={project.result_at ?? ''} />
                  <p className="mt-1 text-xs text-slate-400">未定でも入力しておくと、売上予測（見込み）の計上月に反映されます</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">基本料金 入金予定日</label>
                  <input name="payment_due_date" type="date" className="input" defaultValue={project.payment_due_date ?? ''} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">基本料金 入金日（実績）</label>
                  <input name="payment_received_date" type="date" className="input" defaultValue={project.payment_received_date ?? ''} />
                  <p className="mt-1 text-xs text-slate-400">入力すると、売上台帳の下書き行のうち基本料金分が自動で「確定」になります</p>
                </div>
              </>
            ) : (
              <>
                <TaxAmountInput name="web_fee_excl_tax" label="制作費" defaultValueExclTax={project.web_fee_excl_tax} />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">入金予定日</label>
                  <input name="payment_due_date" type="date" className="input" defaultValue={project.payment_due_date ?? ''} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">入金日（実績）</label>
                  <input name="payment_received_date" type="date" className="input" defaultValue={project.payment_received_date ?? ''} />
                </div>
              </>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">HP URL</label>
            <input name="homepage_url" type="url" className="input" defaultValue={project.homepage_url ?? ''} placeholder="https://example.co.jp" />
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
