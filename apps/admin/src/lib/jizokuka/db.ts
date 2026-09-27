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
}

export interface JizokukaHearing {
  case_id: string
  industry: string | null
  employee_count: number | null
  recent_revenue: number | null
  swot_strength: string | null
  swot_weakness: string | null
  swot_opportunity: string | null
  swot_threat: string | null
  market_trends: string | null
  customer_needs: string | null
  business_policy_goal: string | null
  future_plan: string | null
  subsidy_goal: string | null
}

export interface JizokukaDraftSection {
  id: string
  case_id: string
  title: string
  body: string
  char_target: number | null
  sort_order: number
}

const jz = () => createClient().schema('jizokuka')

export async function fetchCases(): Promise<JizokukaCase[]> {
  const { data, error } = await jz()
    .from('cases')
    .select('id, business_name, representative, status, deadline_date, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as JizokukaCase[]
}

export async function createCase(input: {
  business_name: string
  representative: string | null
  deadline_date: string | null
}): Promise<string> {
  const client = createClient()
  const { data: { user } } = await client.auth.getUser()
  const { data, error } = await client.schema('jizokuka').from('cases').insert({
    ...input,
    staff_user_id: user?.id ?? null,
  }).select('id').single()
  if (error) throw error

  const { error: hearingErr } = await client.schema('jizokuka').from('case_hearings').insert({
    case_id: data.id,
  })
  if (hearingErr) throw hearingErr

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
  if (caseErr) throw caseErr
  if (hearingErr) throw hearingErr
  if (sectionsErr) throw sectionsErr
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
  if (error) throw error
}

export async function updateCaseStatus(caseId: string, status: JizokukaCaseStatus): Promise<void> {
  const { error } = await jz()
    .from('cases')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', caseId)
  if (error) throw error
}

export async function updateSectionBody(sectionId: string, body: string): Promise<void> {
  const { error } = await jz()
    .from('case_draft_sections')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', sectionId)
  if (error) throw error
}

export async function generateInitialDraft(caseId: string): Promise<void> {
  const res = await fetch(`/api/jizokuka/cases/${caseId}/generate`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'AI下書きの生成に失敗しました')
  }
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
