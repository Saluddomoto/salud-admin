'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/hooks/useAuth'
import { fetchContracts, insertContract, deleteContract, type DbContract } from '@/lib/db'
import { CONTRACT_TEMPLATES, getContractTemplate, toReiwa, centerForPlainText } from '@/lib/contractTemplates'

function todayIso(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

// コピー用: プレーンテキストではCSSでの中央寄せができないため、全角スペースで見た目を合わせる
function toClipboardText(title: string, body: string): string {
  return `${centerForPlainText(title)}\n\n\n${body}`
}

function openPrintWindow(title: string, body: string) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.title = title
  const style = w.document.createElement('style')
  style.textContent = `
    body { font-family: "Yu Mincho", "MS Mincho", serif; line-height: 1.9; padding: 2.5rem; max-width: 720px; margin: 0 auto; }
    h1 { text-align: center; font-size: 18px; font-weight: 700; margin: 0 0 2.5rem; }
    pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; }
    @media print { body { padding: 0; } }
  `
  const h1 = w.document.createElement('h1')
  h1.textContent = title
  const pre = w.document.createElement('pre')
  pre.textContent = body
  w.document.head.appendChild(style)
  w.document.body.appendChild(h1)
  w.document.body.appendChild(pre)
  w.focus()
  setTimeout(() => w.print(), 300)
}

export default function ContractsPage() {
  const { role } = useAuth()
  const canDelete = role === 'admin' || role === 'manager'

  const [contracts, setContracts] = useState<DbContract[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [detail,  setDetail]  = useState<DbContract | null>(null)

  const load = () => {
    fetchContracts()
      .then(setContracts)
      .catch(() => setError('契約書の取得に失敗しました'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="契約書作成" description="テンプレートに相手先の情報を差し込んで契約書を作成します">
        <button className="btn-primary text-sm" onClick={() => setAddOpen(true)}>+ 契約書を作成</button>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="flex flex-col gap-2.5">
        {loading && <p className="p-12 text-center text-sm text-slate-400">読み込み中...</p>}

        {!loading && contracts.map(c => {
          const tpl = getContractTemplate(c.template_key)
          return (
            <button
              key={c.id}
              onClick={() => setDetail(c)}
              className="card flex items-start gap-4 p-4 text-left transition-shadow hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-brand-50 text-xs text-brand-700">{tpl?.label ?? c.template_key}</span>
                  <p className="text-sm font-semibold text-slate-900">{c.partner_name}</p>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  契約日 {toReiwa(c.contract_date)}
                  {c.author ? ` · 作成: ${c.author.full_name}` : ''}
                </p>
              </div>
            </button>
          )
        })}

        {!loading && contracts.length === 0 && (
          <div className="card p-12 text-center text-sm text-slate-400">
            契約書はまだ作成されていません。「＋契約書を作成」からどうぞ。
          </div>
        )}
      </div>

      {addOpen && (
        <AddModal
          onClose={() => setAddOpen(false)}
          onSaved={(c) => { setAddOpen(false); load(); setDetail(c) }}
        />
      )}

      {detail && (() => {
        const tpl = getContractTemplate(detail.template_key)
        const docTitle = tpl?.title ?? '契約書'
        return (
          <Modal title={tpl?.label ?? '契約書'} open onClose={() => setDetail(null)}>
            <div className="space-y-4">
              <p className="text-center text-base font-bold text-slate-900">{docTitle}</p>
              <textarea
                readOnly
                value={detail.body}
                rows={14}
                className="input resize-y whitespace-pre-wrap font-serif text-sm leading-relaxed"
              />
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                {canDelete ? (
                  <button
                    onClick={async () => {
                      if (!confirm('この契約書を削除しますか？')) return
                      await deleteContract(detail.id)
                      setDetail(null)
                      load()
                    }}
                    className="text-sm text-rose-500 hover:text-rose-600"
                  >
                    削除
                  </button>
                ) : <span />}
                <div className="flex gap-2">
                  <button
                    className="btn-secondary text-sm"
                    onClick={() => navigator.clipboard.writeText(toClipboardText(docTitle, detail.body))}
                  >
                    コピー
                  </button>
                  <button
                    className="btn-primary text-sm"
                    onClick={() => openPrintWindow(docTitle, detail.body)}
                  >
                    印刷 / PDF化
                  </button>
                </div>
              </div>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}

function AddModal({ onClose, onSaved }: {
  onClose: () => void
  onSaved: (c: DbContract) => void
}) {
  const [templateKey, setTemplateKey]   = useState(CONTRACT_TEMPLATES[0]!.key)
  const [partnerName, setPartnerName]   = useState('')
  const [partnerAddress, setPartnerAddress] = useState('')
  const [repName, setRepName]           = useState('')
  const [contractDate, setContractDate] = useState(todayIso())
  const [saving, setSaving]             = useState(false)
  const [err, setErr]                   = useState('')

  const template = useMemo(() => getContractTemplate(templateKey)!, [templateKey])

  const preview = useMemo(() => {
    if (!partnerName || !partnerAddress || !repName) return ''
    return template.render({
      partnerName, partnerAddress, representativeName: repName, contractDate,
    })
  }, [template, partnerName, partnerAddress, repName, contractDate])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      const body = template.render({
        partnerName, partnerAddress, representativeName: repName, contractDate,
      })
      const saved = await insertContract({
        template_key: templateKey,
        partner_name: partnerName,
        partner_address: partnerAddress,
        representative_name: repName,
        contract_date: contractDate,
        body,
      })
      onSaved(saved)
    } catch {
      setErr('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="契約書を作成" open onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">テンプレート</label>
          <select value={templateKey} onChange={e => setTemplateKey(e.target.value)} className="input">
            {CONTRACT_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-400">{template.description}</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">相手先会社名 *</label>
          <input value={partnerName} onChange={e => setPartnerName(e.target.value)} required className="input" placeholder="株式会社〇〇" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">相手先住所 *</label>
          <input value={partnerAddress} onChange={e => setPartnerAddress(e.target.value)} required className="input" placeholder="東京都〇〇区..." />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">代表者名 *</label>
            <input value={repName} onChange={e => setRepName(e.target.value)} required className="input" placeholder="山田 太郎" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">契約日 *</label>
            <input type="date" value={contractDate} onChange={e => setContractDate(e.target.value)} required className="input" />
          </div>
        </div>

        {preview && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">プレビュー</label>
            <p className="mb-1.5 text-center text-sm font-bold text-slate-900">{template.title}</p>
            <textarea readOnly value={preview} rows={10} className="input resize-y whitespace-pre-wrap font-serif text-xs leading-relaxed" />
          </div>
        )}

        {err && <p className="text-sm text-rose-600">{err}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>キャンセル</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? '保存中...' : '作成する'}</button>
        </div>
      </form>
    </Modal>
  )
}
