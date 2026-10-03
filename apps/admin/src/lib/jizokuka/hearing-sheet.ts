import ExcelJS from 'exceljs'
import type { JizokukaBasicInfo, JizokukaHearing, SalesEffect, ScheduleItem, TopService } from './db'

// 「01_小規模事業者持続化補助金_ヒアリングシート（2026）」(.xlsx) を読み取り、
// 基本情報・ヒアリング・経費明細の各画面に反映できる形へ変換する。
// Googleスプレッドシートの場合は「ファイル → ダウンロード → .xlsx」で保存したものを使う。
// セル番地は上記シートのレイアウトに固定（シート構成を変えた場合はここを直す）。

// 経費明細画面のカテゴリー（expenses/page.tsx の CATEGORIES と同じ）。シートの経費区分名をこの表記に合わせる
const EXPENSE_CATEGORIES = [
  '①機械装置等費', '②広報費', '③ウェブサイト関連費', '④展示会等出展費',
  '⑤旅費', '⑥新商品開発費', '⑦借料', '⑧委託・外注費', '⑨設備処分費',
]
const plain = (t: string) => t.replace(/[①-⑩・\s]/g, '')
const toExpenseCategory = (sheetName: string) =>
  EXPENSE_CATEGORIES.find(c => plain(c) === plain(sheetName)) ?? sheetName

export type ParsedExpense = {
  category: string
  description: string
  amount: number
  is_website_related: boolean
}

export type ParsedHearingSheet = {
  basic: Partial<Omit<JizokukaBasicInfo, 'case_id'>>
  hearing: Partial<Omit<JizokukaHearing, 'case_id'>>
  expenses: ParsedExpense[]
  businessName: string
  representative: string
}

type Sheet = ExcelJS.Worksheet

function raw(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === 'object') {
    if ('richText' in v) return v.richText.map(r => r.text).join('')
    if ('result' in v) return v.result
    if ('text' in v) return v.text
  }
  return v
}

function str(ws: Sheet, addr: string): string {
  const v = raw(ws.getCell(addr).value)
  if (v == null) return ''
  if (v instanceof Date) return `${v.getUTCFullYear()}-${v.getUTCMonth() + 1}-${v.getUTCDate()}`
  return String(v).trim()
}

function num(ws: Sheet, addr: string): number | null {
  const v = raw(ws.getCell(addr).value)
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,，円％%\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

const checked = (ws: Sheet, addr: string) => str(ws, addr) !== ''

/** 「・」だけの空欄行を除き、箇条書きの形で連結する */
function bullets(ws: Sheet, rows: number[]): string {
  return rows
    .map(r => str(ws, `B${r}`).replace(/^[・･\s]+/, '').trim())
    .filter(Boolean)
    .map(t => `・${t}`)
    .join('\n')
}

/** 2015/4/1・2015年4月1日・2015-04-01 などを YYYY-MM-DD にする（読めなければ undefined） */
function toIsoDate(s: string): string | undefined {
  const m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  if (!m) return undefined
  return `${m[1]}-${(m[2] ?? '').padStart(2, '0')}-${(m[3] ?? '').padStart(2, '0')}`
}

function splitAddress(address: string) {
  const m = address.match(/^(.{2,3}?[都道府県])(.+?[市区町村])(.*)$/)
  return m
    ? { prefecture: m[1] ?? '', city: m[2] ?? '', detail: (m[3] ?? '').trim() }
    : { prefecture: '', city: '', detail: address }
}

function splitName(name: string) {
  const [last, ...rest] = name.split(/[\s　]+/)
  return { last: last ?? '', first: rest.join(' ') }
}

/** 値が空でないものだけを残す（既存の入力を空欄で上書きしないため） */
function compact<T>(o: Record<string, unknown>): Partial<T> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  ) as Partial<T>
}

export async function parseHearingSheet(buffer: ArrayBuffer): Promise<ParsedHearingSheet> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const [s1, s2, s3] = wb.worksheets
  if (!s1 || !s2 || !s3 || !str(s1, 'A1').includes('ヒアリングシート')) {
    throw new Error('持続化補助金ヒアリングシート（2026）のファイルではないようです（基本情報・現状分析・今後の事業の3シートが必要です）')
  }

  const n0 = (ws: Sheet, a: string) => num(ws, a) ?? 0
  const employees = n0(s1, 'J13') + n0(s1, 'N13') + n0(s1, 'R13') + n0(s1, 'X13')
  const addr = splitAddress(str(s1, 'G9'))
  const contact = splitName(str(s1, 'G14'))
  const capitalMan = num(s1, 'S21')
  const isCorporation = !!(str(s1, 'G21') || capitalMan || str(s1, 'I22') || /株式会社|有限会社|合同会社|法人/.test(str(s1, 'G5')))

  const pick = (pairs: [string, string][]) => pairs.find(([a]) => checked(s1, a))?.[1] ?? ''
  const pastApplications = ([
    ['B41', '小規模事業者持続化補助金（通常型）'],
    ['K41', '小規模事業者持続化補助金（コロナ特別対応型）'],
    ['B42', '低感染リスク型ビジネス枠'],
  ] as const).filter(([a]) => checked(s1, a)).map(([, l]) => l)

  const sameAsHq = checked(s1, 'A49') || !checked(s1, 'A50')
  const locationAddress = sameAsHq ? '' : str(s1, 'B51')

  const basic = compact<Omit<JizokukaBasicInfo, 'case_id'>>({
    company_name_kana: str(s1, 'G4'),
    postal_code: str(s1, 'G8'),
    prefecture: addr.prefecture,
    city: addr.city,
    address_detail: addr.detail,
    website_url: str(s1, 'G12'),
    established_date: toIsoDate(str(s1, 'G10')),
    representative_birthdate: toIsoDate(str(s1, 'G11')),
    business_form: isCorporation ? '法人' : '個人事業主',
    capital_amount: capitalMan == null ? undefined : capitalMan * 10000,
    tax_status: pick([
      ['A45', '課税事業者（本則課税）'],
      ['H45', '課税事業者（２割特例）'],
      ['O45', '課税事業者（簡易課税）'],
      ['A46', '免税事業者'],
    ]),
    invoice_exception: str(s1, 'E34') === '希望する' ? '希望する（補助上限+50万円）' : str(s1, 'E34') === '希望しない' ? '希望しない' : undefined,
    business_location_address: locationAddress,
    gross_profit_recent: num(s1, 'T29') ?? undefined,
    operating_profit_recent: num(s1, 'T30') ?? undefined,
    contact_last_name: contact.last,
    contact_first_name: contact.first,
    contact_title: str(s1, 'G15'),
    contact_phone: str(s1, 'G18'),
    contact_mobile: str(s1, 'G19'),
    contact_email: str(s1, 'G17'),
    company_phone: str(s1, 'G18'),
    past_adoption_summary: pastApplications.join('、'),
    priority_policy_points: str(s1, 'E35'),
    policy_points: str(s1, 'E36'),
  })

  const topServices: TopService[] = [7, 8, 9]
    .map(r => ({ name: str(s2, `E${r}`), ratio_pct: num(s2, `S${r}`), unit_price: num(s2, `W${r}`) }))
    .filter(s => s.name)
    // シートの「売上に占める割合」は 0.4 のような比率（セルの書式が%）。% の数値で保持する
    .map(s => ({ ...s, ratio_pct: s.ratio_pct == null ? null : s.ratio_pct <= 1 ? Math.round(s.ratio_pct * 1000) / 10 : s.ratio_pct }))

  const salesEffects: SalesEffect[] = [14, 15, 16]
    .map(r => ({
      target: str(s3, `B${r}`),
      offering: str(s3, `J${r}`),
      unit_price: num(s3, `R${r}`),
      customers: num(s3, `U${r}`),
      frequency: num(s3, `X${r}`),
    }))
    .filter(e => e.target || e.offering || e.unit_price)

  const expenses: ParsedExpense[] = [4, 5, 6, 7, 8, 9]
    .map(r => {
      const category = toExpenseCategory(str(s3, `B${r}`))
      const item = str(s3, `E${r}`)
      const qty = num(s3, `M${r}`)
      const note = str(s3, `O${r}`)
      return {
        category,
        description: [item, qty && qty > 1 ? `×${qty}` : '', note ? `（${note}）` : ''].filter(Boolean).join(' '),
        amount: num(s3, `J${r}`) ?? 0,
        is_website_related: plain(category) === 'ウェブサイト関連費',
      }
    })
    .filter(e => e.category || e.description || e.amount)

  // v2 の「4.補足情報」タブ（無い旧シートでも読める）
  const s4 = wb.getWorksheet('4.補足情報')
  const supplement: Partial<Omit<JizokukaHearing, 'case_id'>> = {}
  if (s4) {
    const text = (a: string) => str(s4, a)
    const schedule: ScheduleItem[] = [6, 7, 8, 9, 10, 11]
      .map(r => ({ task: text(`B${r}`), start: text(`C${r}`), end: text(`D${r}`) }))
      .filter(i => i.task || i.start || i.end)
    const yn = text('C14')
    Object.assign(supplement, compact<Omit<JizokukaHearing, 'case_id'>>({
      efficiency_enabled: yn === 'はい' ? true : yn === 'いいえ' ? false : undefined,
      efficiency_items: text('C15'),
      efficiency_current: text('C16'),
      efficiency_effect: text('C17'),
      order_channels: text('C20'),
      marketing_issues: text('C21'),
      payment_terms: text('C22'),
      expansion_plans: text('C23'),
      target_sales_y1: num(s4, 'C26') ?? undefined,
      target_sales_y3: num(s4, 'C27') ?? undefined,
      target_sales_basis: text('C28'),
      profit_target: text('C29'),
      founder_background: text('C32'),
      company_history: text('C33'),
      market_sources: text('C36'),
      customer_examples: text('C37'),
      track_record: text('C38'),
      attachments_note: text('C41'),
    }))
    if (schedule.length) supplement.implementation_schedule = schedule
  }

  const wantsText = expenses.map(e => `${e.category}：${e.description}`).join('\n')

  const hearing = compact<Omit<JizokukaHearing, 'case_id'>>({
    employee_count: employees || undefined,
    recent_revenue: num(s1, 'T28') == null ? undefined : String(num(s1, 'T28')),
    swot_strength: bullets(s2, [21, 22, 23]),
    swot_weakness: bullets(s2, [29, 30, 31]),
    swot_opportunity: bullets(s2, [38, 39, 40]),
    swot_threat: bullets(s2, [46, 47, 48]),
    customer_segments: bullets(s2, [14, 15, 16]),
    appeal_points: bullets(s3, [25, 26, 27, 28]),
    subsidy_goal: wantsText,
    gross_margin_pct: num(s3, 'B20') ?? undefined,
    growth_pct: num(s3, 'B22') ?? undefined,
  })
  Object.assign(hearing, supplement)
  if (topServices.length) hearing.top_services = topServices
  if (salesEffects.length) hearing.sales_effects = salesEffects

  return { basic, hearing, expenses, businessName: str(s1, 'G5'), representative: str(s1, 'G7') }
}

export { forecastSales } from './forecast'
