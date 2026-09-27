'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { fetchCaseDetail, type JizokukaCase, type JizokukaDraftSection } from '@/lib/jizokuka/db'
import { splitSectionTitle } from '@/lib/jizokuka/sections'
import { buildApplicationDocxBlob, downloadBlob } from '@/lib/jizokuka/word-export'

export default function ExportPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const router = useRouter()
  const [caseInfo, setCaseInfo] = useState<JizokukaCase | null>(null)
  const [sections, setSections] = useState<JizokukaDraftSection[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetchCaseDetail(caseId).then(({ case: c, sections: s }) => {
      setCaseInfo(c)
      setSections(s)
    }).finally(() => setLoading(false))
  }, [caseId])

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      alert('コピーに失敗しました')
    }
  }

  const copyAll = () => {
    const all = sections.map(s => `【${splitSectionTitle(s.title).label}】\n${s.body}`).join('\n\n')
    copy('all', all)
  }

  const downloadWord = async () => {
    setDownloading(true)
    try {
      const blob = await buildApplicationDocxBlob(caseInfo?.business_name ?? '申請書', sections)
      downloadBlob(blob, `${caseInfo?.business_name ?? '申請書'}_持続化補助金下書き.docx`)
    } catch {
      alert('Wordファイルの作成に失敗しました')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-400">読み込み中…</div>

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title={`電子申請システムへのコピー用テキスト — ${caseInfo?.business_name ?? ''}`}
        description="jizokuka-portal.info への入力用にセクションごとコピーできます"
      >
        <button className="btn-secondary" onClick={() => router.push(`/jizokuka-pilot/cases/${caseId}/review`)}>
          レビューに戻る
        </button>
        <button className="btn-secondary" onClick={downloadWord} disabled={downloading}>
          {downloading ? '作成中…' : 'Wordでダウンロード'}
        </button>
        <button className="btn-primary" onClick={copyAll}>
          {copiedId === 'all' ? 'コピーしました' : '全文をコピー'}
        </button>
      </PageHeader>

      <div className="flex flex-col gap-4">
        {sections.map((s, i) => {
          const { group, label } = splitSectionTitle(s.title)
          const prevSection = sections[i - 1]
          const prevGroup = prevSection ? splitSectionTitle(prevSection.title).group : null
          return (
            <div key={s.id} className="flex flex-col gap-4">
              {group !== prevGroup && (
                <h2 className="mt-2 text-base font-bold text-slate-900 first:mt-0">{group}</h2>
              )}
              <div className="card flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">{label}</h3>
                  <button className="btn-secondary" onClick={() => copy(s.id, s.body)}>
                    {copiedId === s.id ? 'コピーしました' : 'コピー'}
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{s.body}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
