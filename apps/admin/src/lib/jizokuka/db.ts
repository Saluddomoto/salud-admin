import { createClient } from '@/lib/supabase'

// 持続化パイロット（小規模事業者持続化補助金の申請書AI下書きツール）専用のデータアクセス層。
// Salud本体の src/lib/db.ts とは意図的に分離し、`jizokuka` スキーマのみを扱う
// （将来このツールを別プロジェクトに切り出す際、このファイルだけ持ち出せば済むようにするため）。

export type JizokukaCaseStatus = 'draft' | 'review' | 'confirmed'

export interface JizokukaCase {
  id: string
  business_name: string
  representative: string | null
  status: JizokukaCaseStatus
  deadline_date: string | null
  created_at: string
  updated_at: string
  subsidy_rate: number
  subsidy_cap: number
  self_funds: number | null
  loan_funds: number | null
  other_funds: number | null
}

export interface TopService {
  name: string
  ratio_pct: number | null
  unit_price: number | null
}

export interface SalesEffect {
  target: string
  offering: string
  unit_price: number | null
  customers: number | null
  frequency: number | null
}

export interface JizokukaHearing {
  case_id: string
  industry: string | null
  employee_count: number | null
  recent_revenue: string | null
  swot_strength: string | null
  swot_weakness: string | null
  swot_opportunity: string | null
  swot_threat: string | null
  market_trends: string | null
  customer_needs: string | null
  business_policy_goal: string | null
  future_plan: string | null
  subsidy_goal: string | null
  top_services: TopService[]
  customer_segments: string | null
  sales_effects: SalesEffect[]
  gross_margin_pct: number | null
  growth_pct: number | null
  appeal_points: string | null
  sheet_imported_at: string | null
  sheet_file_name: string | null
}

export interface JizokukaDraftSection {
  id: string
  case_id: string
  title: string
  body: string
  char_target: number | null
  sort_order: number
}

export interface JizokukaBasicInfo {
  case_id: string
  project_start_method: string | null
  project_end_date: string | null
  has_project_income: boolean | null
  income_detail: string | null
  invoice_exception: string | null
  wage_increase_exception: string | null
  referred_chamber: string | null
  chamber_membership: string | null
  postal_code: string | null
  prefecture: string | null
  city: string | null
  address_detail: string | null
  corporate_number: string | null
  company_name_kana: string | null
  business_form: string | null
  tax_status: string | null
  representative_title: string | null
  representative_birthdate: string | null
  representative_phone: string | null
  company_phone: string | null
  invoice_registration_number: string | null
  website_url: string | null
  industry_category: string | null
  capital_amount: number | null
  established_date: string | null
  office_count: number | null
  business_location_postal: string | null
  business_location_address: string | null
  gross_profit_recent: number | null
  operating_profit_recent: number | null
  contact_last_name: string | null
  contact_first_name: string | null
  contact_title: string | null
  contact_phone: string | null
  contact_mobile: string | null
  contact_email: string | null
  advice_from_other: boolean | null
  advice_amount: number | null
  advice_provider: string | null
  past_adoption_summary: string | null
  priority_policy_points: string | null
  policy_points: string | null
}

export interface JizokukaExpenseItem {
  id: string
  case_id: string
  category: string | null
  description: string | null
  amount: number
  is_website_related: boolean
  sort_order: number
}

const EMPTY_BASIC_INFO_KEYS: (keyof Omit<JizokukaBasicInfo, 'case_id'>)[] = [
  'project_start_method', 'project_end_date', 'has_project_income', 'income_detail',
  'invoice_exception', 'wage_increase_exception', 'referred_chamber', 'chamber_membership',
  'postal_code', 'prefecture', 'city', 'address_detail', 'corporate_number', 'company_name_kana',
  'business_form', 'tax_status', 'representative_title', 'representative_birthdate',
  'representative_phone', 'company_phone', 'invoice_registration_number', 'website_url',
  'industry_category', 'capital_amount', 'established_date', 'office_count',
  'business_location_postal', 'business_location_address', 'gross_profit_recent',
  'operating_profit_recent', 'contact_last_name', 'contact_first_name', 'contact_title',
  'contact_phone', 'contact_mobile', 'contact_email', 'advice_from_other', 'advice_amount',
  'advice_provider', 'past_adoption_summary', 'priority_policy_points', 'policy_points',
]

const jz = () => createClient().schema('jizokuka')

export async function fetchCases(): Promise<JizokukaCase[]> {
  const { data, error } = await jz()
    .from('cases')
    .select('id, business_name, representative, status, deadline_date, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as JizokukaCase[]
}

export async function createCase(input: {
  business_name: string
  representative: string | null
  deadline_date: string | null
}): Promise<string> {
  const client = createClient()
  const [{ data: { user } }, { data: tenant, error: tenantErr }] = await Promise.all([
    client.auth.getUser(),
    client.schema('jizokuka').from('tenants').select('id').limit(1).single(),
  ])
  if (tenantErr || !tenant) throw new Error(tenantErr?.message ?? 'テナント情報の取得に失敗しました')

  const { data, error } = await client.schema('jizokuka').from('cases').insert({
    ...input,
    tenant_id: tenant.id,
    staff_user_id: user?.id ?? null,
  }).select('id').single()
  if (error) throw new Error(error.message)

  const { error: hearingErr } = await client.schema('jizokuka').from('case_hearings').insert({
    case_id: data.id,
  })
  if (hearingErr) throw new Error(hearingErr.message)

  const { error: basicInfoErr } = await client.schema('jizokuka').from('case_basic_info').insert({
    case_id: data.id,
  })
  if (basicInfoErr) throw new Error(basicInfoErr.message)

  return data.id as string
}

export async function fetchCaseDetail(caseId: string): Promise<{
  case: JizokukaCase
  hearing: JizokukaHearing
  sections: JizokukaDraftSection[]
}> {
  const client = jz()
  const [{ data: caseRow, error: caseErr }, { data: hearing, error: hearingErr }, { data: sections, error: sectionsErr }] =
    await Promise.all([
      client.from('cases').select('*').eq('id', caseId).single(),
      client.from('case_hearings').select('*').eq('case_id', caseId).single(),
      client.from('case_draft_sections').select('*').eq('case_id', caseId).order('sort_order'),
    ])
  if (caseErr) throw new Error(caseErr.message)
  if (hearingErr) throw new Error(hearingErr.message)
  if (sectionsErr) throw new Error(sectionsErr.message)
  return {
    case: caseRow as JizokukaCase,
    hearing: hearing as JizokukaHearing,
    sections: (sections ?? []) as JizokukaDraftSection[],
  }
}

export async function saveHearing(
  caseId: string,
  input: Partial<Omit<JizokukaHearing, 'case_id'>>,
): Promise<void> {
  const { error } = await jz()
    .from('case_hearings')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('case_id', caseId)
  if (error) throw new Error(error.message)
}

export async function updateCaseStatus(caseId: string, status: JizokukaCaseStatus): Promise<void> {
  const { error } = await jz()
    .from('cases')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', caseId)
  if (error) throw new Error(error.message)
}

export async function updateSectionBody(sectionId: string, body: string): Promise<void> {
  const { error } = await jz()
    .from('case_draft_sections')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', sectionId)
  if (error) throw new Error(error.message)
}

export async function generateInitialDraft(caseId: string): Promise<void> {
  const res = await fetch(`/api/jizokuka/cases/${caseId}/generate`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'AI下書きの生成に失敗しました')
  }
}

export async function fetchBasicInfo(caseId: string): Promise<JizokukaBasicInfo> {
  const { data, error } = await jz().from('case_basic_info').select('*').eq('case_id', caseId).maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return data as JizokukaBasicInfo
  const empty = { case_id: caseId } as JizokukaBasicInfo
  for (const key of EMPTY_BASIC_INFO_KEYS) {
    (empty as unknown as Record<string, null>)[key] = null
  }
  return empty
}

export async function saveBasicInfo(
  caseId: string,
  input: Partial<Omit<JizokukaBasicInfo, 'case_id'>>,
): Promise<void> {
  const { error } = await jz()
    .from('case_basic_info')
    .upsert({ case_id: caseId, ...input, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
}

export async function fetchExpenseItems(caseId: string): Promise<JizokukaExpenseItem[]> {
  const { data, error } = await jz()
    .from('case_expense_items')
    .select('*')
    .eq('case_id', caseId)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []) as JizokukaExpenseItem[]
}

export async function addExpenseItem(caseId: string, sortOrder: number): Promise<JizokukaExpenseItem> {
  const { data, error } = await jz()
    .from('case_expense_items')
    .insert({ case_id: caseId, sort_order: sortOrder })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as JizokukaExpenseItem
}

export async function updateExpenseItem(
  id: string,
  input: Partial<Pick<JizokukaExpenseItem, 'category' | 'description' | 'amount' | 'is_website_related'>>,
): Promise<void> {
  const { error } = await jz().from('case_expense_items').update(input).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteExpenseItem(id: string): Promise<void> {
  const { error } = await jz().from('case_expense_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateCaseFunding(caseId: string, input: {
  subsidy_rate?: number
  subsidy_cap?: number
  self_funds?: number | null
  loan_funds?: number | null
  other_funds?: number | null
}): Promise<void> {
  const { error } = await jz()
    .from('cases')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', caseId)
  if (error) throw new Error(error.message)
}

export interface JizokukaEvaluationCriterion {
  label: string
  verdict: '十分' | 'やや不足' | '不足'
  comment: string
}

export interface JizokukaEvaluation {
  criteria: JizokukaEvaluationCriterion[]
  overallComment: string
}

export async function evaluateCase(caseId: string): Promise<JizokukaEvaluation> {
  const res = await fetch(`/api/jizokuka/cases/${caseId}/evaluate`, { method: 'POST' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? '審査基準のチェックに失敗しました')
  return body as JizokukaEvaluation
}

export async function regenerateSection(sectionId: string, instruction: string): Promise<string> {
  const res = await fetch(`/api/jizokuka/sections/${sectionId}/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? 'AI再生成に失敗しました')
  return body.body as string
}

/**
 * 提出されたヒアリングシートの内容を各画面（基本情報・ヒアリング・経費明細）に反映する。
 * シートに記入のある項目だけを上書きし、空欄の項目は既存の入力を残す。
 * 経費明細は既存の行の後ろに追加する（二重取込の場合は呼び出し側で確認する）。
 */
export async function applyHearingSheet(
  caseId: string,
  parsed: {
    basic: Partial<Omit<JizokukaBasicInfo, 'case_id'>>
    hearing: Partial<Omit<JizokukaHearing, 'case_id'>>
    expenses: { category: string; description: string; amount: number; is_website_related: boolean }[]
  },
  fileName: string,
): Promise<void> {
  const client = jz()
  const now = new Date().toISOString()

  const { error: basicErr } = await client
    .from('case_basic_info')
    .upsert({ case_id: caseId, ...parsed.basic, updated_at: now })
  if (basicErr) throw new Error(`基本情報の反映に失敗しました: ${basicErr.message}`)

  const { error: hearingErr } = await client
    .from('case_hearings')
    .update({ ...parsed.hearing, sheet_imported_at: now, sheet_file_name: fileName, updated_at: now })
    .eq('case_id', caseId)
  if (hearingErr) throw new Error(`ヒアリングの反映に失敗しました: ${hearingErr.message}`)

  if (parsed.expenses.length) {
    const { data: last } = await client
      .from('case_expense_items')
      .select('sort_order')
      .eq('case_id', caseId)
      .order('sort_order', { ascending: false })
      .limit(1)
    const start = (last?.[0]?.sort_order ?? -1) + 1
    const { error: expErr } = await client
      .from('case_expense_items')
      .insert(parsed.expenses.map((e, i) => ({ case_id: caseId, ...e, sort_order: start + i })))
    if (expErr) throw new Error(`経費明細の反映に失敗しました: ${expErr.message}`)
  }
}
