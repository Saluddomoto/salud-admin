'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchInvoices, insertInvoice, updateInvoice, deleteInvoice, fetchCustomers,
  fetchInvoiceNoteTemplates, insertInvoiceNoteTemplate, deleteInvoiceNoteTemplate,
  type DbInvoice, type DbCustomer, type InvoiceItem, type InvoiceInput, type InvoiceDocType,
  type DbInvoiceNoteTemplate,
} from '@/lib/db'
import {
  DEFAULT_NOTES, DOC_TYPE_LABELS, computeTotals, formatYen, formatJaDate, openInvoiceWindow,
  copyInvoiceToClipboard, emptyItem,
} from '@/lib/invoiceDocument'

const DOC_TYPES: InvoiceDocType[] = ['invoice', 'estimate']
const DUE_DATE_LABELS: Record<InvoiceDocType, string> = {
  invoice: '支払期日',
  estimate: '見積有効期限',
}

function todayIso(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

function jstNow(): { y: number; m: number } {
  const d = new Date(Date.now() + 9 * 3600_000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }
}

function isInMonth(isoDate: string, y: number, m: number): boolean {
  const [dy, dm] = isoDate.split('-').map(Number)
  return dy === y && dm === m
}

type FormState = {
  doc_type: InvoiceDocType
  customer_id: string | null
  billing_name: string
  issue_date: string
  due_date: string
  tax_rate: number
  items: InvoiceItem[]
  notes: string
}

function emptyForm(docType: InvoiceDocType = 'invoice'): FormState {
  return {
    doc_type: docType,
    customer_id: null,
    billing_name: '',
    issue_date: todayIso(),
    due_date: '',
    tax_rate: 10,
    items: [emptyItem()],
    notes: DEFAULT_NOTES,
  }
}

function formToInput(form: FormState): InvoiceInput {
  return {
    doc_type: form.doc_type,
    customer_id: form.customer_id,
    billing_name: form.billing_name.trim(),
    issue_date: form.issue_date,
    due_date: form.due_date || null,
    tax_rate: form.tax_rate,
    items: form.items.filter(it => it.name.trim() || it.quantity || it.unit_price),
    notes: form.notes,
  }
}

function CustomerFillPicker({ customers, onPick }: {
  customers: DbCustomer[]
  onPick: (customer: DbCustomer) => void
}) {
  if (customers.length === 0) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="mb-1.5 block text-xs font-medium text-slate-500">顧客登録情報から入力（会社名を請求先に自動で入れます）</label>
      <select
        defaultValue=""
        onChange={e => {
          const c = customers.find(x => x.id === e.target.value)
          if (c) onPick(c)
          e.target.value = ''
        }}
        className="input text-sm"
      >
        <option value="" disabled>顧客を選択...</option>
        {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
      </select>
    </div>
  )
}

function ItemsEditor({ items, setItems }: {
  items: InvoiceItem[]
  setItems: (items: InvoiceItem[]) => void
}) {
  const update = (idx: number, patch: Partial<InvoiceItem>) => {
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }
  const remove = (idx: number) => setItems(items.filter((_, i) => i !== idx))
  const add = () => setItems([...items, emptyItem()])
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const tmp = next[idx]!
    next[idx] = next[target]!
    next[target] = tmp
    setItems(next)
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">明細</label>
      {items.map((it, idx) => (
        <div key={idx} className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-25"
                aria-label="上に移動"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(idx, 1)}
                disabled={idx === items.length - 1}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-25"
                aria-label="下に移動"
              >
                ▼
              </button>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <input
                placeholder="項目" value={it.name}
                onChange={e => update(idx, { name: e.target.value })}
                className="input text-sm"
              />
              <input
                placeholder="作業内容" value={it.work}
                onChange={e => update(idx, { work: e.target.value })}
                className="input text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <input
                type="number" placeholder="数量" value={it.quantity}
                onChange={e => update(idx, { quantity: Number(e.target.value) })}
                className="input text-sm"
              />
              <p className="mt-0.5 text-xs text-slate-400">数量</p>
            </div>
            <div>
              <input
                type="number" placeholder="単価" value={it.unit_price}
                onChange={e => update(idx, { unit_price: Number(e.target.value) })}
                className="input text-sm"
              />
              <p className="mt-0.5 text-xs text-slate-400">単価</p>
            </div>
            <div className="flex flex-col justify-between">
              <p className="pt-2 text-right text-sm font-medium text-slate-700">{formatYen(it.quantity * it.unit_price)}</p>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="self-end text-xs text-rose-500 hover:text-rose-600"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="btn-secondary w-full text-sm">＋ 明細行を追加</button>
    </div>
  )
}

function TotalsSummary({ items, taxRate }: { items: InvoiceItem[]; taxRate: number }) {
  const { subtotal, tax, total } = computeTotals(items, taxRate)
  return (
    <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
      <div className="flex justify-between text-slate-500"><span>小計</span><span>{formatYen(subtotal)}</span></div>
      <div className="flex justify-between text-slate-500"><span>消費税（{taxRate}%）</span><span>{formatYen(tax)}</span></div>
      <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900"><span>合計</span><span>{formatYen(total)}</span></div>
    </div>
  )
}

function NoteTemplatesBar({ templates, notes, setNotes, onChanged }: {
  templates: DbInvoiceNoteTemplate[]
  notes: string
  setNotes: (notes: string) => void
  onChanged: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [label, setLabel] = useState('')

  const append = (body: string) => {
    setNotes(notes.trim() ? `${notes}\n\n${body}` : body)
  }

  const save = async () => {
    if (!label.trim() || !notes.trim()) return
    await insertInvoiceNoteTemplate({ label: label.trim(), body: notes })
    setLabel('')
    setSaving(false)
    onChanged()
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-400">定型文:</span>
        {templates.map(t => (
          <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1.5 text-xs text-slate-600">
            <button type="button" onClick={() => append(t.body)} className="hover:text-brand-600">{t.label}</button>
            <button
              type="button"
              onClick={async () => { if (confirm(`定型文「${t.label}」を削除しますか？`)) { await deleteInvoiceNoteTemplate(t.id); onChanged() } }}
              className="text-slate-300 hover:text-rose-500"
              aria-label="削除"
            >
              ×
            </button>
          </span>
        ))}
        {!saving && (
          <button type="button" onClick={() => setSaving(true)} className="text-xs font-medium text-brand-600 hover:underline">
            ＋ 現在の内容を定型文として保存
          </button>
        )}
      </div>
      {saving && (
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="定型文の名前（例：GMOあおぞら銀行）"
            className="input text-sm"
          />
          <button type="button" onClick={save} className="btn-secondary shrink-0 text-xs">保存</button>
          <button type="button" onClick={() => { setSaving(false); setLabel('') }} className="shrink-0 text-xs text-slate-400 hover:text-slate-600">キャンセル</button>
        </div>
      )}
    </div>
  )
}

function InvoiceForm({ form, setForm, customers, noteTemplates, onNoteTemplatesChanged }: {
  form: FormState
  setForm: (updater: (prev: FormState) => FormState) => void
  customers: DbCustomer[]
  noteTemplates: DbInvoiceNoteTemplate[]
  onNoteTemplatesChanged: () => void
}) {
  const fillFromCustomer = (customer: DbCustomer) => {
    setForm(prev => ({ ...prev, customer_id: customer.id, billing_name: `${customer.company_name}　御中` }))
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">書類種別</label>
        <div className="inline-flex rounded-lg border border-slate-200 p-1">
          {DOC_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setForm(prev => ({ ...prev, doc_type: t }))}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                form.doc_type === t ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {DOC_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <CustomerFillPicker customers={customers} onPick={fillFromCustomer} />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">請求先</label>
        <input
          value={form.billing_name}
          onChange={e => setForm(prev => ({ ...prev, billing_name: e.target.value }))}
          placeholder="例）多田 真以　様 / 株式会社◯◯　御中"
          className="input"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">発行日</label>
          <input
            type="date" value={form.issue_date}
            onChange={e => setForm(prev => ({ ...prev, issue_date: e.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{DUE_DATE_LABELS[form.doc_type]}</label>
          <input
            type="date" value={form.due_date}
            onChange={e => setForm(prev => ({ ...prev, due_date: e.target.value }))}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">税率（%）</label>
        <input
          type="number" value={form.tax_rate}
          onChange={e => setForm(prev => ({ ...prev, tax_rate: Number(e.target.value) }))}
          className="input w-32"
        />
      </div>

      <ItemsEditor items={form.items} setItems={items => setForm(prev => ({ ...prev, items }))} />

      <TotalsSummary items={form.items} taxRate={form.tax_rate} />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">備考（振込先・契約条件など）</label>
        <NoteTemplatesBar
          templates={noteTemplates}
          notes={form.notes}
          setNotes={notes => setForm(prev => ({ ...prev, notes }))}
          onChanged={onNoteTemplatesChanged}
        />
        <textarea
          value={form.notes}
          onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
          rows={6}
          className="input resize-y whitespace-pre-wrap text-sm leading-normal"
        />
      </div>

      <button
        type="button"
        className="text-xs font-medium text-brand-600 hover:underline"
        onClick={() => openInvoiceWindow({ ...formToInput(form), invoice_no: '（自動採番）' }, false)}
      >
        実際の見た目で開く
      </button>
    </div>
  )
}

export default function InvoicesPage() {
  const { role } = useAuth()
  const canDelete = role === 'admin' || role === 'manager'

  const [invoices, setInvoices]           = useState<DbInvoice[]>([])
  const [customers, setCustomers]         = useState<DbCustomer[]>([])
  const [noteTemplates, setNoteTemplates] = useState<DbInvoiceNoteTemplate[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')

  const [activeType, setActiveType] = useState<InvoiceDocType>('invoice')
  const [{ y, m }, setYm] = useState(jstNow)

  const [addOpen, setAddOpen]   = useState(false)
  const [detail, setDetail]     = useState<DbInvoice | null>(null)
  const [editing, setEditing]   = useState<DbInvoice | null>(null)

  const load = () => {
    Promise.all([fetchInvoices(), fetchCustomers()])
      .then(([i, c]) => { setInvoices(i); setCustomers(c) })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }
  const loadNoteTemplates = () => {
    fetchInvoiceNoteTemplates().then(setNoteTemplates).catch(() => setNoteTemplates([]))
  }
  useEffect(load, [])
  useEffect(loadNoteTemplates, [])

  const shiftMonth = (delta: number) => {
    setYm(prev => {
      const total = (prev.y * 12 + (prev.m - 1)) + delta
      return { y: Math.floor(total / 12), m: (total % 12) + 1 }
    })
  }

  const visible = useMemo(
    () => invoices.filter(inv => inv.doc_type === activeType && isInMonth(inv.issue_date, y, m)),
    [invoices, activeType, y, m]
  )
  const monthTotal = useMemo(
    () => visible.reduce((sum, inv) => sum + computeTotals(inv.items, inv.tax_rate).total, 0),
    [visible]
  )

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="請求書・見積書発行" description="明細を入力して請求書・見積書を作成・プレビュー・印刷/PDF化します">
        <button className="btn-primary text-sm" onClick={() => setAddOpen(true)}>＋ {DOC_TYPE_LABELS[activeType]}を作成</button>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 p-1">
          {DOC_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                activeType === t ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {DOC_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="rounded-lg px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100"
            aria-label="前の月"
          >
            ‹
          </button>
          <span className="min-w-[6rem] text-center text-sm font-semibold text-slate-800">
            {y}年{m}月
          </span>
          <button
            onClick={() => shiftMonth(1)}
            className="rounded-lg px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100"
            aria-label="次の月"
          >
            ›
          </button>
        </div>
      </div>

      {!loading && visible.length > 0 && (
        <p className="text-xs text-slate-400">
          {y}年{m}月の{DOC_TYPE_LABELS[activeType]} {visible.length}件・合計 {formatYen(monthTotal)}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {loading && <p className="p-12 text-center text-sm text-slate-400">読み込み中...</p>}

        {!loading && visible.map(inv => {
          const { total } = computeTotals(inv.items, inv.tax_rate)
          return (
            <button
              key={inv.id}
              onClick={() => setDetail(inv)}
              className="card flex items-start gap-4 p-4 text-left transition-shadow hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">{inv.invoice_no}</span>
                  <p className="text-sm font-semibold text-slate-900">{inv.billing_name}</p>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  発行日 {formatJaDate(inv.issue_date)} ・ 合計 {formatYen(total)}
                  {inv.author ? ` ・ 作成: ${inv.author.full_name}` : ''}
                </p>
              </div>
            </button>
          )
        })}

        {!loading && visible.length === 0 && (
          <div className="card p-12 text-center text-sm text-slate-400">
            {y}年{m}月の{DOC_TYPE_LABELS[activeType]}はまだありません。「＋{DOC_TYPE_LABELS[activeType]}を作成」からどうぞ。
          </div>
        )}
      </div>

      {addOpen && (
        <AddModal
          customers={customers}
          noteTemplates={noteTemplates}
          onNoteTemplatesChanged={loadNoteTemplates}
          initialDocType={activeType}
          onClose={() => setAddOpen(false)}
          onSaved={(inv) => { setAddOpen(false); load(); setDetail(inv) }}
        />
      )}

      {detail && (
        <Modal title={`${DOC_TYPE_LABELS[detail.doc_type]}　${detail.invoice_no}`} open onClose={() => setDetail(null)} size="full">
          <DetailView
            invoice={detail}
            canDelete={canDelete}
            onEdit={() => setEditing(detail)}
            onDeleted={() => { setDetail(null); load() }}
          />
        </Modal>
      )}

      {editing && (
        <EditModal
          invoice={editing}
          customers={customers}
          noteTemplates={noteTemplates}
          onNoteTemplatesChanged={loadNoteTemplates}
          onClose={() => setEditing(null)}
          onSaved={(inv) => { setEditing(null); setDetail(inv); load() }}
        />
      )}
    </div>
  )
}

function DetailView({ invoice, canDelete, onEdit, onDeleted }: {
  invoice: DbInvoice
  canDelete: boolean
  onEdit: () => void
  onDeleted: () => void
}) {
  const { subtotal, tax, total } = computeTotals(invoice.items, invoice.tax_rate)
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">{invoice.billing_name}</p>
        <p className="text-xs text-slate-400">
          発行日 {formatJaDate(invoice.issue_date)}
          {invoice.due_date ? ` ・ ${DUE_DATE_LABELS[invoice.doc_type]} ${formatJaDate(invoice.due_date)}` : ''}
        </p>
      </div>

      <div className="space-y-1 text-sm">
        {invoice.items.map((it, idx) => (
          <div key={idx} className="flex justify-between border-b border-slate-100 py-1.5">
            <span className="text-slate-600">{it.name}{it.work ? `（${it.work}）` : ''} × {it.quantity}</span>
            <span className="font-medium text-slate-900">{formatYen(it.quantity * it.unit_price)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
        <div className="flex justify-between text-slate-500"><span>小計</span><span>{formatYen(subtotal)}</span></div>
        <div className="flex justify-between text-slate-500"><span>消費税（{invoice.tax_rate}%）</span><span>{formatYen(tax)}</span></div>
        <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900"><span>合計</span><span>{formatYen(total)}</span></div>
      </div>

      <textarea readOnly value={invoice.notes} rows={5} className="input resize-y whitespace-pre-wrap text-xs leading-normal" />

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        {canDelete ? (
          <button
            onClick={async () => {
              if (!confirm(`この${DOC_TYPE_LABELS[invoice.doc_type]}を削除しますか？`)) return
              await deleteInvoice(invoice.id)
              onDeleted()
            }}
            className="text-sm text-rose-500 hover:text-rose-600"
          >
            削除
          </button>
        ) : <span />}
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary text-sm" onClick={onEdit}>編集</button>
          <button className="btn-secondary text-sm" onClick={() => copyInvoiceToClipboard(invoice)}>コピー</button>
          <button className="btn-secondary text-sm" onClick={() => openInvoiceWindow(invoice, false)}>プレビュー</button>
          <button className="btn-primary text-sm" onClick={() => openInvoiceWindow(invoice, true)}>印刷 / PDF化</button>
        </div>
      </div>
    </div>
  )
}

function AddModal({ customers, noteTemplates, onNoteTemplatesChanged, initialDocType, onClose, onSaved }: {
  customers: DbCustomer[]
  noteTemplates: DbInvoiceNoteTemplate[]
  onNoteTemplatesChanged: () => void
  initialDocType: InvoiceDocType
  onClose: () => void
  onSaved: (inv: DbInvoice) => void
}) {
  const [form, setForm] = useState<FormState>(() => emptyForm(initialDocType))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.billing_name.trim()) { setErr('請求先を入力してください'); return }
    setSaving(true)
    setErr('')
    try {
      const saved = await insertInvoice(formToInput(form))
      onSaved(saved)
    } catch {
      setErr('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`${DOC_TYPE_LABELS[form.doc_type]}を作成`} open onClose={onClose} size="full">
      <form onSubmit={handleSubmit} className="space-y-4">
        <InvoiceForm
          form={form} setForm={updater => setForm(updater)} customers={customers}
          noteTemplates={noteTemplates} onNoteTemplatesChanged={onNoteTemplatesChanged}
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 pb-4 pt-4">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>キャンセル</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? '保存中...' : `${DOC_TYPE_LABELS[form.doc_type]}を作成する`}</button>
        </div>
      </form>
    </Modal>
  )
}

function EditModal({ invoice, customers, noteTemplates, onNoteTemplatesChanged, onClose, onSaved }: {
  invoice: DbInvoice
  customers: DbCustomer[]
  noteTemplates: DbInvoiceNoteTemplate[]
  onNoteTemplatesChanged: () => void
  onClose: () => void
  onSaved: (inv: DbInvoice) => void
}) {
  const [form, setForm] = useState<FormState>(() => ({
    doc_type: invoice.doc_type,
    customer_id: invoice.customer_id,
    billing_name: invoice.billing_name,
    issue_date: invoice.issue_date,
    due_date: invoice.due_date ?? '',
    tax_rate: invoice.tax_rate,
    items: invoice.items.length ? invoice.items : [emptyItem()],
    notes: invoice.notes,
  }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!form.billing_name.trim()) { setErr('請求先を入力してください'); return }
    setSaving(true)
    setErr('')
    try {
      const saved = await updateInvoice(invoice.id, formToInput(form))
      onSaved(saved)
    } catch {
      setErr('保存に失敗しました')
      setSaving(false)
    }
  }

  return (
    <Modal title={`${invoice.invoice_no} を編集`} open onClose={onClose} size="full">
      <div className="space-y-4">
        <InvoiceForm
          form={form} setForm={updater => setForm(updater)} customers={customers}
          noteTemplates={noteTemplates} onNoteTemplatesChanged={onNoteTemplatesChanged}
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 pb-4 pt-4">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>キャンセル</button>
          <button type="button" disabled={saving} onClick={save} className="btn-primary text-sm">{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </Modal>
  )
}
