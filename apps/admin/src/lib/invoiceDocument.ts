// 請求書のHTML生成・印刷・コピーのユーティリティ。
// 元になったGoogleスプレッドシートのひな形と同じレイアウト
// （発行者/請求先ヘッダー・明細テーブル・小計/消費税/合計・振込先などのフッター）を再現する。
import type { InvoiceDocType, InvoiceItem } from '@/lib/db'
import { SEAL_IMAGE_DATA_URI } from '@/lib/assets/sealImage'

export const DOC_TYPE_LABELS: Record<InvoiceDocType, string> = {
  invoice: '請求書',
  estimate: '見積書',
}

const DOC_TYPE_META: Record<InvoiceDocType, {
  title: string
  docNoLabel: string
  dueDateLabel: string
  greeting: string
}> = {
  invoice: {
    title: '御請求書',
    docNoLabel: '請求書番号',
    dueDateLabel: '支払期日',
    greeting: 'この度は誠に有難う御座います。<br/>御請求書を作成致しました。<br/>下記、詳細となりますので、ご査収の程よろしくお願いいたします。',
  },
  estimate: {
    title: '御見積書',
    docNoLabel: '見積書番号',
    dueDateLabel: '見積有効期限',
    greeting: 'この度はお問い合わせいただき誠に有難う御座います。<br/>下記の通りお見積り申し上げます。<br/>ご検討の程よろしくお願いいたします。',
  },
}

export const ISSUER = {
  name: '株式会社Salud',
  representative: '代表取締役　堂本　拓央',
  addressLine1: '東京都渋谷区道玄坂1丁目10番8号',
  addressLine2: '渋谷道玄坂東急ビル2F−C',
  tel: '050-6869-6588',
  mail: 'domoto@salud-web.jp',
  invoiceRegistrationNo: 'T6011001152105',
}

export const DEFAULT_NOTES =
  `GMOあおぞらネット銀行(金融機関コード0310） 法人営業部 普通口座 2483422 カ）サル―\n` +
  `なお、振込み手数料は御社にてご負担お願いします。\n` +
  `契約方法：電子サイン\n` +
  `何かご不明な点などございましたら、お気軽にご連絡下さい。`

export function computeTotals(items: InvoiceItem[], taxRate: number) {
  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0)
  const tax = Math.round(subtotal * (taxRate / 100))
  const total = subtotal + tax
  return { subtotal, tax, total }
}

export function formatYen(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`
}

export function formatJaDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${y}年${Number(m)}月${Number(d)}日`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function nl2br(s: string): string {
  return escapeHtml(s).split('\n').map(line => line || '&nbsp;').join('<br/>')
}

type InvoiceLike = {
  invoice_no: string
  doc_type: InvoiceDocType
  billing_name: string
  issue_date: string
  due_date: string | null
  items: InvoiceItem[]
  tax_rate: number
  notes: string
}

export function buildInvoiceHtml(invoice: InvoiceLike): string {
  const meta = DOC_TYPE_META[invoice.doc_type]
  const { subtotal, tax, total } = computeTotals(invoice.items, invoice.tax_rate)
  const rows = invoice.items
  const showWork = rows.some(it => it.work.trim())
  const leadingColspan = showWork ? 3 : 2

  const itemRows = rows.map(it => `
    <tr>
      <td class="cell">${escapeHtml(it.name)}</td>
      ${showWork ? `<td class="cell">${escapeHtml(it.work)}</td>` : ''}
      <td class="cell num">${it.quantity ? it.quantity.toLocaleString() : ''}</td>
      <td class="cell num">${it.unit_price ? formatYen(it.unit_price) : ''}</td>
      <td class="cell num">${it.name || it.quantity || it.unit_price ? formatYen(it.quantity * it.unit_price) : ''}</td>
    </tr>`).join('')

  return `
    <div class="doc">
      <h1>${meta.title}</h1>
      <div class="head">
        <div class="issuer">
          <div class="issuer-name-row">
            <div class="issuer-name">${escapeHtml(ISSUER.name)}</div>
            <img class="seal" src="${SEAL_IMAGE_DATA_URI}" alt="" />
          </div>
          <div>${escapeHtml(ISSUER.representative)}</div>
          <div>${escapeHtml(ISSUER.addressLine1)}</div>
          <div>${escapeHtml(ISSUER.addressLine2)}</div>
          <div>tel:${escapeHtml(ISSUER.tel)}</div>
          <div>mail:${escapeHtml(ISSUER.mail)}</div>
          <div>適格請求書発行事業者登録番号${escapeHtml(ISSUER.invoiceRegistrationNo)}</div>
        </div>
        <div class="billing">
          <div class="billing-name">${escapeHtml(invoice.billing_name)}</div>
          <div class="invoice-no">${meta.docNoLabel}：${escapeHtml(invoice.invoice_no)}</div>
          <div class="greeting">
            日付：${formatJaDate(invoice.issue_date)}<br/>
            ${meta.greeting}
          </div>
        </div>
      </div>

      <table class="items">
        <thead>
          <tr><th>項目</th>${showWork ? '<th>作業内容</th>' : ''}<th class="num">数量</th><th class="num">単価</th><th class="num">金額</th></tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr><td colspan="${leadingColspan}"></td><td class="label">小計</td><td class="num">${formatYen(subtotal)}</td></tr>
          <tr><td colspan="${leadingColspan}"></td><td class="label">${invoice.tax_rate.toFixed(2)}%</td><td class="num">${formatYen(tax)}</td></tr>
          <tr><td colspan="${leadingColspan}"></td><td class="label total">合計</td><td class="num total">${formatYen(total)}</td></tr>
        </tfoot>
      </table>

      ${invoice.due_date ? `<p class="due">${meta.dueDateLabel}：${formatJaDate(invoice.due_date)}</p>` : ''}

      <div class="notes">${nl2br(invoice.notes)}</div>
    </div>
  `
}

const BRAND = '#4f46e5'

const PRINT_STYLE = `
  @page { size: A4; margin: 16mm 18mm; }
  html, body { width: 100%; }
  body { font-family: "Yu Mincho", "MS Mincho", serif; line-height: 1.5; width: 740px; max-width: 100%; margin: 0 auto; padding: 2rem 0 3rem; color: #1e293b; }
  .doc { border-top: 4px solid ${BRAND}; padding-top: 1.5rem; }
  h1 { text-align: center; font-size: 22px; font-weight: 700; letter-spacing: 0.25em; margin: 0 0 1.75rem; color: ${BRAND}; }
  .head { display: flex; justify-content: space-between; gap: 2rem; font-size: 12px; margin-bottom: 1.75rem; }
  .issuer, .billing { flex: 1; }
  .issuer-name-row { display: flex; align-items: center; gap: 10px; margin-bottom: 0.25rem; }
  .issuer-name, .billing-name { font-size: 14px; font-weight: 700; }
  .billing-name { border-bottom: 2px solid #1e293b; padding-bottom: 0.35rem; margin-bottom: 0.5rem; display: inline-block; }
  .seal { width: 52px; height: 52px; opacity: 0.9; flex-shrink: 0; }
  .invoice-no { font-size: 11px; color: #64748b; margin-bottom: 0.75rem; }
  .greeting { margin-top: 0.75rem; }
  table.items { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 0.5rem; }
  table.items th, table.items td.cell { border: 1px solid #cbd5e1; padding: 7px 9px; }
  table.items thead th { background: #eef2ff; color: ${BRAND}; font-weight: 700; border-color: ${BRAND}; }
  table.items td.num, table.items th.num { text-align: right; }
  table.items tfoot td { padding: 4px 9px; border: none; }
  table.items tfoot td.label { text-align: right; font-weight: 700; }
  table.items tfoot td.total { font-size: 15px; color: ${BRAND}; border-top: 2px solid ${BRAND}; }
  p.due { text-align: right; font-size: 12px; margin: 0 0 1rem; }
  .notes { font-size: 11px; white-space: normal; border-top: 1px solid #cbd5e1; padding-top: 0.75rem; }
  @media print { body { padding: 0; } }
`

// autoPrint=false: プレビューとして表示のみ／true: 印刷ダイアログまで自動で開く
export function openInvoiceWindow(invoice: InvoiceLike, autoPrint: boolean) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.title = `${DOC_TYPE_META[invoice.doc_type].title}_${invoice.billing_name}`
  const style = w.document.createElement('style')
  style.textContent = PRINT_STYLE
  w.document.head.appendChild(style)
  w.document.body.innerHTML = buildInvoiceHtml(invoice)
  w.focus()
  if (autoPrint) setTimeout(() => w.print(), 300)
}

export async function copyInvoiceToClipboard(invoice: InvoiceLike) {
  const meta = DOC_TYPE_META[invoice.doc_type]
  const { subtotal, tax, total } = computeTotals(invoice.items, invoice.tax_rate)
  const html = `<div>${buildInvoiceHtml(invoice)}</div>`
  const text = [
    meta.title,
    ISSUER.name,
    invoice.billing_name,
    `${meta.docNoLabel}：${invoice.invoice_no}`,
    `日付：${formatJaDate(invoice.issue_date)}`,
    '',
    ...invoice.items.map(it => `${it.name} ${it.work} 数量:${it.quantity} 単価:${formatYen(it.unit_price)} 金額:${formatYen(it.quantity * it.unit_price)}`),
    '',
    `小計：${formatYen(subtotal)}`,
    `消費税(${invoice.tax_rate}%)：${formatYen(tax)}`,
    `合計：${formatYen(total)}`,
    '',
    invoice.notes,
  ].join('\n')
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

export function emptyItem(): InvoiceItem {
  return { name: '', work: '', quantity: 1, unit_price: 0 }
}
