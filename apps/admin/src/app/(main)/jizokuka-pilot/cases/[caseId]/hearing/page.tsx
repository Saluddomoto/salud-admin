'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  fetchCaseDetail, saveHearing, generateInitialDraft,
  type JizokukaCase, type JizokukaHearing,
} from '@/lib/jizokuka/db'

type FormState = {
  industry: string
  employee_count: string
  recent_revenue: string
  swot_strength: string
  swot_weakness: string
  swot_opportunity: string
  swot_threat: string
  market_trends: string
  customer_needs: string
  business_policy_goal: string
  future_plan: string
  subsidy_goal: string
}

const EMPTY: FormState = {
  industry: '', employee_count: '', recent_revenue: '',
  swot_strength: '', swot_weakness: '', swot_opportunity: '', swot_threat: '',
  market_trends: '', customer_needs: '', business_policy_goal: '', future_plan: '', subsidy_goal: '',
}

function toFormState(h: JizokukaHearing): FormState {
  return {
    industry: h.industry ?? '',
    employee_count: h.employee_count?.toString() ?? '',
    recent_revenue: h.recent_revenue?.toString() ?? '',
    swot_strength: h.swot_strength ?? '',
    swot_weakness: h.swot_weakness ?? '',
    swot_opportunity: h.swot_opportunity ?? '',
    swot_threat: h.swot_threat ?? '',
    market_trends: h.market_trends ?? '',
    customer_needs: h.customer_needs ?? '',
    business_policy_goal: h.business_policy_goal ?? '',
    future_plan: h.future_plan ?? '',
    subsidy_goal: h.subsidy_goal ?? '',
  }
}

export default function HearingPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const router = useRouter()
  const [caseInfo, setCaseInfo] = useState<JizokukaCase | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchCaseDetail(caseId).then(({ case: c, hearing }) => {
      setCaseInfo(c)
      setForm(toFormState(hearing))
    }).finally(() => setLoading(false))
  }, [caseId])

  const set = (key: keyof FormState) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: ev.target.value }))

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    setGenerating(true)
    try {
      await saveHearing(caseId, {
        industry: form.industry || null,
        employee_count: form.employee_count ? Number(form.employee_count) : null,
        recent_revenue: form.recent_revenue ? Number(form.recent_revenue) : null,
        swot_strength: form.swot_strength || null,
        swot_weakness: form.swot_weakness || null,
        swot_opportunity: form.swot_opportunity || null,
        swot_threat: form.swot_threat || null,
        market_trends: form.market_trends || null,
        customer_needs: form.customer_needs || null,
        business_policy_goal: form.business_policy_goal || null,
        future_plan: form.future_plan || null,
        subsidy_goal: form.subsidy_goal || null,
      })
      await generateInitialDraft(caseId)
      router.push(`/jizokuka-pilot/cases/${caseId}/review`)
    } catch (e) {
      alert(`保存・生成に失敗しました: ${e instanceof Error ? e.message : e}`)
      setGenerating(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-400">読み込み中…</div>

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title={`ヒアリング — ${caseInfo?.business_name ?? ''}`}
        description="AIが下書きを作成するための基礎情報を入力してください（数値中心の売上表・経費見積もりはここでは扱いません）"
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <h3 className="text-sm font-bold text-slate-900 sm:col-span-2">基本情報</h3>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">業種</label>
            <input className="input" value={form.industry} onChange={set('industry')} placeholder="例: 飲食サービス業" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">従業員数</label>
            <input className="input" type="number" min={0} value={form.employee_count} onChange={set('employee_count')} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">直近売上（円）</label>
            <input className="input" type="number" min={0} value={form.recent_revenue} onChange={set('recent_revenue')} />
          </div>
        </div>

        <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <h3 className="text-sm font-bold text-slate-900 sm:col-span-2">強み・弱み（SWOT）</h3>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">強み</label>
            <textarea className="input min-h-24" value={form.swot_strength} onChange={set('swot_strength')} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">弱み</label>
            <textarea className="input min-h-24" value={form.swot_weakness} onChange={set('swot_weakness')} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">機会（参考情報）</label>
            <textarea className="input min-h-24" value={form.swot_opportunity} onChange={set('swot_opportunity')} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">脅威（参考情報）</label>
            <textarea className="input min-h-24" value={form.swot_threat} onChange={set('swot_threat')} />
          </div>
        </div>

        <div className="card flex flex-col gap-4 p-5">
          <h3 className="text-sm font-bold text-slate-900">市場・顧客</h3>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">市場の動向</label>
            <textarea className="input min-h-24" value={form.market_trends} onChange={set('market_trends')} placeholder="業界・地域の需要動向など" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">顧客ニーズ</label>
            <textarea className="input min-h-24" value={form.customer_needs} onChange={set('customer_needs')} />
          </div>
        </div>

        <div className="card flex flex-col gap-4 p-5">
          <h3 className="text-sm font-bold text-slate-900">経営方針・補助事業</h3>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">経営方針・目標</label>
            <textarea className="input min-h-24" value={form.business_policy_goal} onChange={set('business_policy_goal')} placeholder="今後の経営方針と数値目標など" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">今後のプラン</label>
            <textarea className="input min-h-24" value={form.future_plan} onChange={set('future_plan')} placeholder="経営方針を実現する具体策" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">補助事業で目指すこと</label>
            <textarea className="input min-h-24" value={form.subsidy_goal} onChange={set('subsidy_goal')} placeholder="今回の補助事業で具体的に何をやるか" />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={generating}>
            {generating ? 'AIが下書きを作成中…' : '保存してAI下書きを生成'}
          </button>
        </div>
      </form>
    </div>
  )
}
