'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { StatusPill } from '@/components/jizokuka/status-pill'
import {
  fetchCaseOverviews, createCase, deleteCase, duplicateCase,
  type JizokukaCaseOverview, type JizokukaCaseStatus,
} from '@/lib/jizokuka/db'

const yen = (n: number | null) => (n == null || n === 0 ? '—' : `${n.toLocaleString('ja-JP')}円`)

function Chip({ label, done, partial, hint }: { label: string; done: boolean; partial?: boolean; hint?: string }) {
  const cls = done
    ? 'bg-emerald-50 text-emerald-700'
    : partial
      ? 'bg-amber-50 text-amber-700'
      : 'bg-slate-100 text-slate-400'
  return (
    <span title={hint} className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] ${cls}`}>
      {done ? '✓ ' : ''}{label}
    </span>
  )
}

export default function JizokukaPilotPage() {
  const router = useRouter()
  const [cases, setCases] = useState<JizokukaCaseOverview[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | JizokukaCaseStatus>('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    fetchCaseOverviews().then(setCases).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleDuplicate = async (c: JizokukaCaseOverview) => {
    if (!window.confirm(`「${c.business_name}」を複製します。ヒアリング・基本情報・経費明細・下書きがコピーされます。`)) return
    try {
      await duplicateCase(c.id)
      load()
    } catch (e) {
      alert(`複製に失敗しました: ${e instanceof Error ? e.message : e}`)
    }
  }

  const handleDelete = async (c: JizokukaCaseOverview) => {
    if (!window.confirm(`「${c.business_name}」を削除します。
ヒアリング・基本情報・経費明細・AI下書きもすべて削除され、元に戻せません。

本当に削除しますか？`)) return
    try {
      await deleteCase(c.id)
      load()
    } catch (e) {
      alert(`削除に失敗しました: ${e instanceof Error ? e.message : e}`)
    }
  }

  const visible = cases.filter(c =>
    (!statusFilter || c.status === statusFilter) &&
    (!query || `${c.business_name}${c.representative ?? ''}`.includes(query.trim())),
  )

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    const f = new FormData(ev.currentTarget)
    setSaving(true)
    try {
      const id = await createCase({
        business_name: String(f.get('business_name')),
        representative: String(f.get('representative')) || null,
        deadline_date: String(f.get('deadline_date')) || null,
      })
      setModalOpen(false)
      router.push(`/jizokuka-pilot/cases/${id}/basic-info`)
    } catch (e) {
      alert(`作成に失敗しました: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="持続化パイロット（テスト版）"
        description="小規模事業者持続化補助金の申請書AI下書きツール"
      >
        <button className="btn-secondary" onClick={() => router.push('/jizokuka-pilot/hearing-sheet')}>
          初回ヒアリングシート
        </button>
        <button className="btn-secondary" onClick={() => router.push('/jizokuka-pilot/guide')}>
          使い方ガイド
        </button>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          + 新規案件を作成
        </button>
      </PageHeader>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input sm:max-w-xs"
          placeholder="事業者名・代表者で検索"
          value={query}
          onChange={ev => setQuery(ev.target.value)}
        />
        <select className="input sm:w-40" value={statusFilter} onChange={ev => setStatusFilter(ev.target.value as '' | JizokukaCaseStatus)}>
          <option value="">すべてのステータス</option>
          <option value="draft">下書き</option>
          <option value="review">レビュー中</option>
          <option value="confirmed">確定</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">事業者名</th>
              <th className="px-4 py-3">ステータス</th>
              <th className="px-4 py-3">入力状況</th>
              <th className="px-4 py-3 text-right">補助額（見込）</th>
              <th className="px-4 py-3 text-right">直近売上</th>
              <th className="px-4 py-3 text-right">従業員</th>
              <th className="px-4 py-3">申請期限</th>
              <th className="px-4 py-3">更新日</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-4 py-6 text-center text-slate-400" colSpan={9}>読み込み中…</td></tr>
            )}
            {!loading && visible.length === 0 && (
              <tr><td className="px-4 py-6 text-center text-slate-400" colSpan={9}>{cases.length === 0 ? 'まだ案件がありません' : '条件に合う案件がありません'}</td></tr>
            )}
            {visible.map(c => (
              <tr
                key={c.id}
                className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                onClick={() => router.push(`/jizokuka-pilot/cases/${c.id}/${c.status === 'draft' ? 'hearing' : 'review'}`)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{c.business_name}</div>
                  <div className="text-xs text-slate-500">{c.representative ?? '—'}</div>
                </td>
                <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Chip label="基本情報" done={c.basicFilled === c.basicTotal} partial={c.basicFilled > 0} hint={`${c.basicFilled}/${c.basicTotal}項目`} />
                    <Chip label="ヒアリング" done={c.hearingFilled === c.hearingTotal} partial={c.hearingFilled > 0} hint={`${c.hearingFilled}/${c.hearingTotal}項目`} />
                    <Chip label={`経費${c.expenseCount ? ` ${c.expenseCount}件` : ''}`} done={c.expenseCount > 0} />
                    <Chip label="下書き" done={c.draftCount > 0} />
                    {c.sheetImported && <Chip label="シート反映済" done={false} partial hint="ヒアリングシートを反映済み" />}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{yen(c.estimatedGrant)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{yen(c.recentRevenue)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{c.employeeCount ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{c.deadline_date ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(c.updated_at).toLocaleDateString('ja-JP')}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right" onClick={ev => ev.stopPropagation()}>
                  <button className="mr-3 text-xs text-slate-500 hover:text-slate-900" onClick={() => handleDuplicate(c)}>複製</button>
                  <button className="text-xs text-red-500 hover:text-red-700" onClick={() => handleDelete(c)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title="新規案件を作成" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">事業者名</label>
            <input name="business_name" required className="input" placeholder="例: 手打ちそば処 六文銭" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">代表者</label>
            <input name="representative" className="input" placeholder="例: 田中 誠一" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">申請期限</label>
            <input name="deadline_date" type="date" className="input" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>キャンセル</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? '作成中…' : '作成してヒアリングへ'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
