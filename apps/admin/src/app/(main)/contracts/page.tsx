'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchContracts, insertContract, deleteContract,
  fetchContractTemplates, updateContractTemplate,
  type DbContract, type DbContractTemplate,
} from '@/lib/db'
import { renderContractBody, toReiwa, CONTRACT_PLACEHOLDERS } from '@/lib/contractTemplates'

function todayIso(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Wordなどリッチテキスト対応先にはHTML(text-align:centerでタイトルを実際に中央寄せ)、
// 非対応の貼り付け先にはプレーンテキストをフォールバックとして両方書き込む
async function copyDocument(title: string, body: string) {
  const html = `<div style="text-align:center;font-weight:bold;font-size:16px;font-family:'Yu Mincho','MS Mincho',serif;margin-bottom:24px;">${escapeHtml(title)}</div><div style="white-space:pre-wrap;font-family:'Yu Mincho','MS Mincho',serif;font-size:12px;line-height:1.6;">${escapeHtml(body)}</div>`
  const text = `${title}\n\n\n${body}`
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ])
  } catch {
    await navigator.clipboard.writeText(text)
  }
}

// autoPrint=false: プレビューとして表示のみ／true: 印刷ダイアログまで自動で開く
function openDocumentWindow(title: string, body: string, autoPrint: boolean) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.title = title
  const style = w.document.createElement('style')
  style.textContent = `
    @page { size: A4; margin: 18mm 20mm; }
    html, body { width: 100%; }
    body { font-family: "Yu Mincho", "MS Mincho", serif; line-height: 1.5; width: 720px; max-width: 100%; margin: 0 auto; padding: 2rem 0; }
    h1 { text-align: center; font-size: 16px; font-weight: 700; margin: 0 0 1.75rem; }
    pre { white-space: pre-wrap; font-family: inherit; font-size: 12px; }
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
  if (autoPrint) setTimeout(() => w.print(), 300)
}

export default function ContractsPage() {
  const { role } = useAuth()
  const canDelete = role === 'admin' || role === 'manager'
  const canEditTemplate = role === 'admin' || role === 'manager'

  const [contracts, setContracts] = useState<DbContract[]>([])
  const [templates, setTemplates] = useState<DbContractTemplate[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  const [addOpen,      setAddOpen]      = useState(false)
  const [detail,       setDetail]       = useState<DbContract | null>(null)
  const [editTemplate, setEditTemplate] = useState<DbContractTemplate | null>(null)

  const getTemplate = (key: string) => templates.find(t => t.key === key)

  const load = () => {
    Promise.all([fetchContracts(), fetchContractTemplates()])
      .then(([c, t]) => { setContracts(c); setTemplates(t) })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="契約書作成" description="テンプレートに相手先の情報を差し込んで契約書を作成します">
        <div className="flex gap-2">
          {canEditTemplate && templates.length > 0 && (
            <button className="btn-secondary text-sm" onClick={() => setEditTemplate(templates[0]!)}>ひな形を編集</button>
          )}
          <button className="btn-primary text-sm" onClick={() => setAddOpen(true)}>+ 契約書を作成</button>
        </div>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="flex flex-col gap-2.5">
        {loading && <p className="p-12 text-center text-sm text-slate-400">読み込み中...</p>}

        {!loading && contracts.map(c => {
          const tpl = getTemplate(c.template_key)
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
          templates={templates}
          onClose={() => setAddOpen(false)}
          onSaved={(c) => { setAddOpen(false); load(); setDetail(c) }}
        />
      )}

      {detail && (() => {
        const tpl = getTemplate(detail.template_key)
        const docTitle = tpl?.title ?? '契約書'
        return (
          <Modal title={tpl?.label ?? '契約書'} open onClose={() => setDetail(null)}>
            <div className="space-y-4">
              <p className="text-center text-base font-bold text-slate-900">{docTitle}</p>
              <textarea
                readOnly
                value={detail.body}
                rows={14}
                className="input resize-y whitespace-pre-wrap font-serif text-sm leading-normal"
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
                    onClick={() => copyDocument(docTitle, detail.body)}
                  >
                    コピー
                  </button>
                  <button
                    className="btn-secondary text-sm"
                    onClick={() => openDocumentWindow(docTitle, detail.body, false)}
                  >
                    プレビュー
                  </button>
                  <button
                    className="btn-primary text-sm"
                    onClick={() => openDocumentWindow(docTitle, detail.body, true)}
                  >
                    印刷 / PDF化
                  </button>
                </div>
              </div>
            </div>
          </Modal>
        )
      })()}

      {editTemplate && (
        <TemplateEditModal
          template={editTemplate}
          onClose={() => setEditTemplate(null)}
          onSaved={() => { setEditTemplate(null); load() }}
        />
      )}
    </div>
  )
}

function AddModal({ templates, onClose, onSaved }: {
  templates: DbContractTemplate[]
  onClose: () => void
  onSaved: (c: DbContract) => void
}) {
  const [templateKey, setTemplateKey]   = useState(templates[0]?.key ?? '')
  const [partnerName, setPartnerName]   = useState('')
  const [partnerAddress, setPartnerAddress] = useState('')
  const [repName, setRepName]           = useState('')
  const [contractDate, setContractDate] = useState(todayIso())
  const [saving, setSaving]             = useState(false)
  const [err, setErr]                   = useState('')

  const template = useMemo(() => templates.find(t => t.key === templateKey), [templates, templateKey])

  const preview = useMemo(() => {
    if (!template || !partnerName || !partnerAddress || !repName) return ''
    return renderContractBody(template.body_template, {
      partnerName, partnerAddress, representativeName: repName, contractDate,
    })
  }, [template, partnerName, partnerAddress, repName, contractDate])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!template) return
    setSaving(true)
    setErr('')
    try {
      const body = renderContractBody(template.body_template, {
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

  if (!template) {
    return (
      <Modal title="契約書を作成" open onClose={onClose}>
        <p className="text-sm text-slate-500">利用できるテンプレートがありません。</p>
      </Modal>
    )
  }

  return (
    <Modal title="契約書を作成" open onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">テンプレート</label>
          <select value={templateKey} onChange={e => setTemplateKey(e.target.value)} className="input">
            {templates.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
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
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">プレビュー</label>
              <button
                type="button"
                className="text-xs font-medium text-brand-600 hover:underline"
                onClick={() => openDocumentWindow(template.title, preview, false)}
              >
                実際の見た目で開く
              </button>
            </div>
            <p className="mb-1.5 text-center text-sm font-bold text-slate-900">{template.title}</p>
            <textarea readOnly value={preview} rows={10} className="input resize-y whitespace-pre-wrap font-serif text-xs leading-normal" />
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

function TemplateEditModal({ template, onClose, onSaved }: {
  template: DbContractTemplate
  onClose: () => void
  onSaved: () => void
}) {
  const [label, setLabel]             = useState(template.label)
  const [description, setDescription] = useState(template.description ?? '')
  const [title, setTitle]             = useState(template.title)
  const [body, setBody]               = useState(template.body_template)
  const [saving, setSaving]           = useState(false)
  const [err, setErr]                 = useState('')

  const save = async () => {
    setSaving(true)
    setErr('')
    try {
      await updateContractTemplate(template.id, {
        label: label.trim(),
        description: description.trim() || null,
        title: title.trim(),
        body_template: body,
      })
      onSaved()
    } catch {
      setErr('保存に失敗しました')
      setSaving(false)
    }
  }

  return (
    <Modal title="契約書ひな形を編集" open onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ここで編集した内容は、今後この画面から作成するすべての契約書に反映されます。既に作成済みの契約書は変わりません。
        </p>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">テンプレート名（一覧・選択に表示）</label>
          <input value={label} onChange={e => setLabel(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">説明</label>
          <input value={description} onChange={e => setDescription(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">文書タイトル（画面・印刷で中央寄せ表示）</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input" />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">本文</label>
          </div>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={16}
            className="input resize-y whitespace-pre-wrap font-mono text-xs leading-normal"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CONTRACT_PLACEHOLDERS.map(p => (
              <button
                key={p.token}
                type="button"
                title={p.label}
                onClick={() => setBody(b => b + p.token)}
                className="badge bg-brand-50 text-xs text-brand-700 hover:bg-brand-100"
              >
                {p.token}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">クリックで本文末尾に挿入。作成フォームの入力値に自動置換されます。</p>
        </div>

        {err && <p className="text-sm text-rose-600">{err}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>キャンセル</button>
          <button type="button" disabled={saving} onClick={save} className="btn-primary text-sm">{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </Modal>
  )
}
