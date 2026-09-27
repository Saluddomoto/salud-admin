'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusPill } from '@/components/jizokuka/status-pill'
import {
  fetchCaseDetail, updateSectionBody, updateCaseStatus, regenerateSection,
  type JizokukaCase, type JizokukaDraftSection,
} from '@/lib/jizokuka/db'
import { splitSectionTitle } from '@/lib/jizokuka/sections'
import { StepNav } from '@/components/jizokuka/step-nav'

function SectionCard({ section, onChange }: {
  section: JizokukaDraftSection
  onChange: (id: string, body: string) => void
}) {
  const { label } = splitSectionTitle(section.title)
  const [body, setBody] = useState(section.body)
  const [instruction, setInstruction] = useState('')
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const handleBlur = async () => {
    if (body === section.body) return
    setSaving(true)
    try {
      await updateSectionBody(section.id, body)
      onChange(section.id, body)
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async () => {
    if (!instruction.trim()) return
    setRegenerating(true)
    try {
      const newBody = await regenerateSection(section.id, instruction)
      setBody(newBody)
      onChange(section.id, newBody)
      setInstruction('')
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">{label}</h3>
        <span className="text-xs text-slate-400">
          {body.length}{section.char_target ? ` / ${section.char_target}文字` : '文字'}
        </span>
      </div>
      <textarea
        className="input min-h-32"
        value={body}
        onChange={ev => setBody(ev.target.value)}
        onBlur={handleBlur}
      />
      {saving && <span className="text-xs text-slate-400">保存中…</span>}
      <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
        <input
          className="input flex-1"
          placeholder="修正指示（例: もっと具体的な数字を入れて）"
          value={instruction}
          onChange={ev => setInstruction(ev.target.value)}
        />
        <button type="button" className="btn-secondary shrink-0" onClick={handleRegenerate} disabled={regenerating}>
          {regenerating ? '生成中…' : 'AIで再生成'}
        </button>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const router = useRouter()
  const [caseInfo, setCaseInfo] = useState<JizokukaCase | null>(null)
  const [sections, setSections] = useState<JizokukaDraftSection[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    fetchCaseDetail(caseId).then(({ case: c, sections: s }) => {
      setCaseInfo(c)
      setSections(s)
    }).finally(() => setLoading(false))
  }, [caseId])

  const handleSectionChange = (id: string, body: string) => {
    setSections(list => list.map(s => (s.id === id ? { ...s, body } : s)))
  }

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await updateCaseStatus(caseId, 'confirmed')
      router.push(`/jizokuka-pilot/cases/${caseId}/export`)
    } finally {
      setConfirming(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-400">読み込み中…</div>

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title={`下書きレビュー — ${caseInfo?.business_name ?? ''}`}
        description="本文を直接編集するか、修正指示を入力してAIに再生成させてください"
      >
        {caseInfo && <StatusPill status={caseInfo.status} />}
        <StepNav caseId={caseId} step="review" onSave={async () => {}} />
        <button className="btn-primary" onClick={handleConfirm} disabled={confirming}>
          {confirming ? '確定中…' : '確定してエクスポートへ'}
        </button>
      </PageHeader>

      {sections.length === 0 && (
        <div className="card p-6 text-center text-slate-400">下書きがまだ生成されていません</div>
      )}

      <div className="flex flex-col gap-4">
        {sections.map((s, i) => {
          const group = splitSectionTitle(s.title).group
          const prevSection = sections[i - 1]
          const prevGroup = prevSection ? splitSectionTitle(prevSection.title).group : null
          return (
            <div key={s.id} className="flex flex-col gap-4">
              {group !== prevGroup && (
                <h2 className="mt-2 text-base font-bold text-slate-900 first:mt-0">{group}</h2>
              )}
              <SectionCard section={s} onChange={handleSectionChange} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
