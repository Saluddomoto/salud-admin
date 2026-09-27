'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { StatusPill } from '@/components/jizokuka/status-pill'
import { fetchCases, createCase, type JizokukaCase } from '@/lib/jizokuka/db'

export default function JizokukaPilotPage() {
  const router = useRouter()
  const [cases, setCases] = useState<JizokukaCase[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    fetchCases().then(setCases).finally(() => setLoading(false))
  }
  useEffect(load, [])

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
        <button className="btn-secondary" onClick={() => router.push('/jizokuka-pilot/guide')}>
          使い方ガイド
        </button>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          + 新規案件を作成
        </button>
      </PageHeader>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">事業者名</th>
              <th className="px-4 py-3">代表者</th>
              <th className="px-4 py-3">ステータス</th>
              <th className="px-4 py-3">申請期限</th>
              <th className="px-4 py-3">更新日</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-4 py-6 text-center text-slate-400" colSpan={5}>読み込み中…</td></tr>
            )}
            {!loading && cases.length === 0 && (
              <tr><td className="px-4 py-6 text-center text-slate-400" colSpan={5}>まだ案件がありません</td></tr>
            )}
            {cases.map(c => (
              <tr
                key={c.id}
                className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                onClick={() => router.push(`/jizokuka-pilot/cases/${c.id}/${c.status === 'draft' ? 'hearing' : 'review'}`)}
              >
                <td className="px-4 py-3 font-medium text-slate-900">{c.business_name}</td>
                <td className="px-4 py-3 text-slate-600">{c.representative ?? '—'}</td>
                <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                <td className="px-4 py-3 text-slate-600">{c.deadline_date ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(c.updated_at).toLocaleDateString('ja-JP')}</td>
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
