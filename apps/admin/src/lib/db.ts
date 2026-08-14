// Supabase データアクセス層（クライアントサイド）
// RLS がロールに応じてアクセス制御するため、ここでは権限チェック不要
import { createClient } from '@/lib/supabase'

export type DbContact = {
  id: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
}

export type DbDocument = {
  id: string
  customer_id: string | null
  project_id: string | null
  title: string
  url: string
  created_at: string
}

export type DbCustomer = {
  id: string
  company_name: string
  company_name_kana: string
  industry: string | null
  employee_count: number | null
  status: 'active' | 'prospect' | 'inactive'
  assigned_user_id: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  notes: string | null
  created_at: string
  profiles: { full_name: string } | null
  customer_contacts: DbContact[]
}

export type DbProject = {
  id: string
  title: string
  subsidy_name: string | null
  project_type: 'subsidy' | 'web'
  status: 'planning' | 'in_progress' | 'submitted' | 'accepted' | 'rejected' | 'completed'
  applied_amount: number | null
  subsidy_amount: number | null
  base_fee: number | null
  success_fee_rate: number | null
  web_fee_excl_tax: number | null
  payment_due_date: string | null
  payment_received_date: string | null
  deadline: string | null
  result_at: string | null
  notes: string | null
  homepage_url: string | null
  customer_id: string | null
  assigned_user_id: string | null
  assigned_user_id_2: string | null
  customers: { company_name: string } | null
  profiles: { full_name: string } | null
  assignee2: { full_name: string } | null
}

export type DbTask = {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  project_id: string | null
  assigned_user_id: string | null
  updated_at: string
  source: 'manual' | 'ai_line'
  reviewed_at: string | null
  projects: { title: string } | null
  profiles: { full_name: string } | null
}

export type NotificationPrefs = {
  deadline_alert: boolean
  new_inquiry: boolean
  task_reminder: boolean
  result_notice: boolean
  weekly_summary: boolean
}

export type DbProfile = {
  id: string
  full_name: string
  role: string
  department: string | null
  is_active: boolean
  notification_prefs: NotificationPrefs
  tasks_shared_with_team: boolean
  digest_enabled: boolean
  line_user_id: string | null
  is_executive: boolean
  annual_target_amount: number | null
}

export type DbEvent = {
  id: string
  title: string
  event_date: string
  start_time: string // 'HH:MM:SS'
  end_time: string
  category: 'sales' | 'meeting' | 'deadline' | 'internal'
  notes: string | null
  assigned_user_id: string | null
  profiles: { full_name: string } | null
}

export type DbMessage = {
  id: string
  channel: 'line' | 'email' | 'web'
  sender_name: string
  company_name: string | null
  body: string
  received_at: string
  is_read: boolean
  needs_reply: boolean
  converted_to: 'project' | 'task' | 'event' | null
  source_type: 'user' | 'group' | 'room'
  line_group_id: string | null
}

const db = () => createClient()

// ── 顧客 ─────────────────────────────────────────────
export async function fetchCustomers(): Promise<DbCustomer[]> {
  const { data, error } = await db()
    .from('customers')
    .select('*, profiles(full_name), customer_contacts(id, name, title, email, phone, is_primary)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as DbCustomer[]
}

export async function fetchCustomer(id: string): Promise<DbCustomer | null> {
  const { data, error } = await db()
    .from('customers')
    .select('*, profiles(full_name), customer_contacts(id, name, title, email, phone, is_primary)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as DbCustomer | null
}

export async function updateCustomer(id: string, input: {
  company_name: string
  industry: string | null
  employee_count: number | null
  status: string
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  notes: string | null
  assigned_user_id?: string | null
}) {
  const { error } = await db().from('customers').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteCustomer(id: string) {
  const { error } = await db().from('customers').delete().eq('id', id)
  if (error) throw error
}

export async function insertContact(customerId: string, input: {
  name: string
  title: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
}) {
  const { error } = await db().from('customer_contacts').insert({ customer_id: customerId, ...input })
  if (error) throw error
}

export async function deleteContact(id: string) {
  const { error } = await db().from('customer_contacts').delete().eq('id', id)
  if (error) throw error
}

// ── 資料（Google Drive などのリンク） ───────────────────
export async function fetchDocuments(
  parent: { customerId: string } | { projectId: string },
): Promise<DbDocument[]> {
  const column = 'customerId' in parent ? 'customer_id' : 'project_id'
  const value  = 'customerId' in parent ? parent.customerId : parent.projectId
  const { data, error } = await db()
    .from('documents')
    .select('id, customer_id, project_id, title, url, created_at')
    .eq(column, value)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as DbDocument[]
}

export async function insertDocument(
  parent: { customerId: string } | { projectId: string },
  input: { title: string; url: string },
) {
  const link = 'customerId' in parent
    ? { customer_id: parent.customerId }
    : { project_id: parent.projectId }
  const { error } = await db().from('documents').insert({ ...link, ...input })
  if (error) throw error
}

export async function deleteDocument(id: string) {
  const { error } = await db().from('documents').delete().eq('id', id)
  if (error) throw error
}

export async function insertCustomer(input: {
  company_name: string
  industry: string
  employee_count: number | null
  status: string
  phone: string
  contact_name: string
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { data, error } = await client
    .from('customers')
    .insert({
      company_name:   input.company_name,
      industry:       input.industry || null,
      employee_count: input.employee_count,
      status:         input.status,
      phone:          input.phone || null,
      assigned_user_id: user?.id ?? null,
    })
    .select('id')
    .single()
  if (error) throw error

  if (input.contact_name) {
    await client.from('customer_contacts').insert({
      customer_id: data.id,
      name:        input.contact_name,
      is_primary:  true,
    })
  }
  return data.id
}

// ── 案件 ─────────────────────────────────────────────
export async function fetchProjects(): Promise<DbProject[]> {
  const { data, error } = await db()
    .from('projects')
    .select('*, customers(company_name), profiles!projects_assigned_user_id_fkey(full_name), assignee2:profiles!projects_assigned_user_id_2_fkey(full_name)')
    .order('deadline', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as DbProject[]
}

export async function insertProject(input: {
  title: string
  subsidy_name: string | null
  project_type?: 'subsidy' | 'web'
  customer_id: string | null
  applied_amount: number | null
  deadline: string | null
  base_fee?: number | null
  success_fee_rate?: number | null
  web_fee_excl_tax?: number | null
  payment_due_date?: string | null
  homepage_url?: string | null
  notes?: string | null
  assigned_user_id?: string | null
  assigned_user_id_2?: string | null
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client.from('projects').insert({
    ...input,
    status: 'planning',
    // 担当1は未指定なら作成者を既定に。担当2はそのまま（未指定=null）
    assigned_user_id:   input.assigned_user_id ?? user?.id ?? null,
    assigned_user_id_2: input.assigned_user_id_2 ?? null,
  })
  if (error) throw error
}

export async function updateProjectStatus(id: string, status: string) {
  const { error } = await db().from('projects').update({ status }).eq('id', id)
  if (error) throw error
}

export async function fetchProject(id: string): Promise<DbProject | null> {
  const { data, error } = await db()
    .from('projects')
    .select('*, customers(company_name), profiles!projects_assigned_user_id_fkey(full_name), assignee2:profiles!projects_assigned_user_id_2_fkey(full_name)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as DbProject | null
}

export async function fetchProjectsByCustomer(customerId: string): Promise<DbProject[]> {
  const { data, error } = await db()
    .from('projects')
    .select('*, customers(company_name), profiles!projects_assigned_user_id_fkey(full_name), assignee2:profiles!projects_assigned_user_id_2_fkey(full_name)')
    .eq('customer_id', customerId)
    .order('deadline', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as DbProject[]
}

export async function updateProject(id: string, input: {
  title: string
  subsidy_name: string | null
  project_type?: 'subsidy' | 'web'
  customer_id?: string | null
  applied_amount: number | null
  subsidy_amount?: number | null
  base_fee?: number | null
  success_fee_rate?: number | null
  web_fee_excl_tax?: number | null
  payment_due_date?: string | null
  payment_received_date?: string | null
  deadline: string | null
  notes: string | null
  homepage_url?: string | null
  assigned_user_id?: string | null
  assigned_user_id_2?: string | null
}) {
  const { error } = await db().from('projects').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteProject(id: string) {
  const { error } = await db().from('projects').delete().eq('id', id)
  if (error) throw error
}

// ── タスク ───────────────────────────────────────────
export async function fetchTasks(): Promise<DbTask[]> {
  const { data, error } = await db()
    .from('tasks')
    .select('*, projects(title), profiles!tasks_assigned_user_id_fkey(full_name)')
    .or('source.eq.manual,reviewed_at.not.is.null')
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as DbTask[]
}

// LINEグループの発言からAIが検出したタスク候補（承認待ち）
export async function fetchDraftTasks(): Promise<DbTask[]> {
  const { data, error } = await db()
    .from('tasks')
    .select('*, projects(title), profiles!tasks_assigned_user_id_fkey(full_name)')
    .eq('source', 'ai_line')
    .is('reviewed_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as DbTask[]
}

// 下書きタスクを内容確認のうえ承認する（通常タスクとして扱われるようになる）
export async function approveDraftTask(id: string, input: {
  title: string
  description?: string | null
  priority: string
  due_date: string | null
  project_id: string | null
  assigned_user_id?: string
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { assigned_user_id, ...rest } = input
  const { error } = await client.from('tasks').update({
    ...rest,
    assigned_user_id: assigned_user_id ?? user?.id ?? null,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
}

export async function dismissDraftTask(id: string) {
  const { error } = await db().from('tasks').delete().eq('id', id)
  if (error) throw error
}

export async function insertTask(input: {
  title: string
  description?: string | null
  priority: string
  due_date: string | null
  project_id: string | null
  assigned_user_id?: string
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { assigned_user_id, ...rest } = input
  const { error } = await client.from('tasks').insert({
    ...rest,
    status: 'todo',
    assigned_user_id: assigned_user_id ?? user?.id ?? null,
    created_by: user?.id ?? null,
  })
  if (error) throw error
}

export async function updateTaskStatus(id: string, status: string) {
  const { error } = await db().from('tasks').update({ status }).eq('id', id)
  if (error) throw error
}

export async function updateTask(id: string, input: {
  title: string
  description?: string | null
  priority: string
  due_date: string | null
  project_id: string | null
  assigned_user_id?: string
}) {
  const { error } = await db().from('tasks').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: string) {
  const { error } = await db().from('tasks').delete().eq('id', id)
  if (error) throw error
}

export async function fetchTasksByProject(projectId: string): Promise<DbTask[]> {
  const { data, error } = await db()
    .from('tasks')
    .select('*, projects(title), profiles!tasks_assigned_user_id_fkey(full_name)')
    .eq('project_id', projectId)
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as DbTask[]
}

// ── 予定 ─────────────────────────────────────────────
export async function fetchEvents(from: string, to: string): Promise<DbEvent[]> {
  const { data, error } = await db()
    .from('events')
    .select('*, profiles!events_assigned_user_id_fkey(full_name)')
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date')
    .order('start_time')
  if (error) throw error
  return data as DbEvent[]
}

export async function insertEvent(input: {
  title: string
  event_date: string
  start_time: string
  end_time: string
  category: string
  notes: string | null
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client.from('events').insert({
    ...input,
    assigned_user_id: user?.id ?? null,
    created_by: user?.id ?? null,
  })
  if (error) throw error
}

// ── 受信トレイ ───────────────────────────────────────
export async function fetchMessages(): Promise<DbMessage[]> {
  const { data, error } = await db()
    .from('messages')
    .select('*')
    .is('dismissed_at', null)
    .order('received_at', { ascending: false })
  if (error) throw error
  return data as DbMessage[]
}

// 受信トレイから消す（ソフト削除）。全端末で除外され連動する。
export async function dismissMessage(id: string) {
  const { error } = await db().from('messages')
    .update({ dismissed_at: new Date().toISOString(), is_read: true, needs_reply: false })
    .eq('id', id)
  if (error) throw error
}

export async function markMessageRead(id: string) {
  const { error } = await db().from('messages').update({ is_read: true }).eq('id', id)
  if (error) throw error
}

export async function markMessageReplied(id: string) {
  const { error } = await db().from('messages')
    .update({ needs_reply: false, is_read: true })
    .eq('id', id)
  if (error) throw error
}

export async function fetchNeedsReplyCount(): Promise<number> {
  const { count, error } = await db()
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('needs_reply', true)
  if (error) throw error
  return count ?? 0
}

// ── メンバー ─────────────────────────────────────────
export async function fetchProfiles(): Promise<DbProfile[]> {
  const { data, error } = await db()
    .from('profiles')
    .select('id, full_name, role, department, is_active, notification_prefs, tasks_shared_with_team, digest_enabled, line_user_id, is_executive, annual_target_amount')
    .order('created_at')
  if (error) throw error
  return data as DbProfile[]
}

// 役員本人（相互閲覧のため、役員が他の役員のプロフィールを読む用）
export async function fetchExecutiveProfiles(): Promise<DbProfile[]> {
  const { data, error } = await db()
    .from('profiles')
    .select('id, full_name, role, department, is_active, notification_prefs, tasks_shared_with_team, digest_enabled, line_user_id, is_executive, annual_target_amount')
    .eq('is_executive', true)
    .eq('is_active', true)
    .order('created_at')
  if (error) throw error
  return data as DbProfile[]
}

export async function fetchMyProfile(): Promise<DbProfile | null> {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return null
  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, role, department, is_active, notification_prefs, tasks_shared_with_team, digest_enabled, line_user_id, is_executive, annual_target_amount')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data as DbProfile
}

export async function updateMyProfile(input: { full_name: string; department: string | null }) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('not signed in')
  const { error } = await client.from('profiles').update(input).eq('id', user.id)
  if (error) throw error
}

export async function updateMyNotificationPrefs(prefs: NotificationPrefs) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('not signed in')
  const { error } = await client.from('profiles').update({ notification_prefs: prefs }).eq('id', user.id)
  if (error) throw error
}

export async function updateMyPassword(newPassword: string) {
  const client = db()
  const { error } = await client.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// admin のみ RLS で許可（profiles: admin all）。他ロールが呼ぶと更新 0 件になる。
export async function updateMemberTasksSharing(id: string, shared: boolean) {
  const { error } = await db().from('profiles').update({ tasks_shared_with_team: shared }).eq('id', id)
  if (error) throw error
}

// メンバーの停止／復帰（admin のみ RLS で許可）。停止中はログインもブロックされる。
export async function updateMemberActive(id: string, active: boolean) {
  const { error } = await db().from('profiles').update({ is_active: active }).eq('id', id)
  if (error) throw error
}

// メンバーごとの朝LINEダイジェスト配信 ON/OFF（admin のみ RLS で許可）
export async function updateMemberDigest(id: string, enabled: boolean) {
  const { error } = await db().from('profiles').update({ digest_enabled: enabled }).eq('id', id)
  if (error) throw error
}

// 役員フラグの付与／解除（admin のみ RLS で許可）。役員月報の対象・相互閲覧範囲を決める
export async function updateMemberExecutive(id: string, isExecutive: boolean) {
  const { error } = await db().from('profiles').update({ is_executive: isExecutive }).eq('id', id)
  if (error) throw error
}

// ── ダッシュボード ───────────────────────────────────
export async function fetchCustomerCount(): Promise<number> {
  const { count, error } = await db()
    .from('customers')
    .select('id', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

// ── 実績（メンバー別・月間） ─────────────────────────
export type PerfProject = {
  id: string
  title: string
  status: DbProject['status']
  applied_amount: number | null
  subsidy_amount: number | null
}

export type MemberPerformance = {
  user_id: string
  full_name: string
  meetings: number         // 商談件数（カレンダーの商談予定）
  deals: number            // 受注（案件化）件数
  accepted_amount: number  // 採択金額合計
  projects: PerfProject[]  // そこから生まれた案件
}

/** 指定月（YYYY-MM-DD 〜 YYYY-MM-DD）のメンバー別実績を集計して返す */
export async function fetchPerformance(startISO: string, endISO: string): Promise<MemberPerformance[]> {
  const { data, error } = await db().rpc('member_performance', { p_start: startISO, p_end: endISO })
  if (error) throw error
  return (data ?? []).map((r: {
    user_id: string; full_name: string; meetings: number; deals: number
    accepted_amount: number; projects: PerfProject[] | null
  }) => ({
    user_id:         r.user_id,
    full_name:       r.full_name,
    meetings:        Number(r.meetings),
    deals:           Number(r.deals),
    accepted_amount: Number(r.accepted_amount),
    projects:        r.projects ?? [],
  }))
}

// ── 共通 ─────────────────────────────────────────────
export function formatAmount(yen: number | null): string {
  if (yen == null) return '—'
  if (yen >= 100_000_000) return `¥${(yen / 100_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}億`
  if (yen >= 10_000) return `¥${Math.round(yen / 10_000).toLocaleString()}万`
  return `¥${yen.toLocaleString()}`
}

export function formatDate(d: string | null): string {
  if (!d) return '—'
  return d.slice(5).replace('-', '/')
}

/* ─── 議事録（Zoom社内MTG）─────────────────────────── */
export type DbMeetingNote = {
  id: string
  title: string
  meeting_date: string | null
  duration_min: number | null
  host_name: string | null
  recording_url: string | null
  transcript: string | null
  summary: string | null
  customer_id: string | null
  project_id: string | null
  source: 'zoom' | 'manual' | 'google_meet'
  created_at: string
  customers: { company_name: string } | null
  projects: { title: string } | null
}

export async function fetchMeetingNotes(): Promise<DbMeetingNote[]> {
  const { data, error } = await db()
    .from('meeting_notes')
    .select('id, title, meeting_date, duration_min, host_name, recording_url, transcript, summary, customer_id, project_id, source, created_at, customers(company_name), projects(title)')
    .order('meeting_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbMeetingNote[]
}

export async function insertMeetingNote(input: {
  title: string
  meeting_date: string | null
  host_name?: string | null
  recording_url?: string | null
  transcript?: string | null
  summary?: string | null
  customer_id?: string | null
  project_id?: string | null
  source?: 'manual' | 'google_meet'
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { source, ...rest } = input
  const { error } = await client.from('meeting_notes').insert({
    ...rest,
    source: source ?? 'manual',
    created_by: user?.id ?? null,
  })
  if (error) throw error
}

export async function updateMeetingNote(id: string, patch: {
  title?: string
  summary?: string | null
  transcript?: string | null
  recording_url?: string | null
  customer_id?: string | null
  project_id?: string | null
}) {
  const { error } = await db()
    .from('meeting_notes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteMeetingNote(id: string) {
  const { error } = await db().from('meeting_notes').delete().eq('id', id)
  if (error) throw error
}

/* ─── ノウハウノート（事務手引きなど、全員が読み書き自由な社内Wiki）─── */
export type DbKnowhowNote = {
  id: string
  title: string
  category: string | null
  body: string
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  author: { full_name: string } | null
  editor: { full_name: string } | null
}

export async function fetchKnowhowNotes(): Promise<DbKnowhowNote[]> {
  const { data, error } = await db()
    .from('knowhow_notes')
    .select('*, author:profiles!knowhow_notes_created_by_fkey(full_name), editor:profiles!knowhow_notes_updated_by_fkey(full_name)')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbKnowhowNote[]
}

export async function insertKnowhowNote(input: {
  title: string
  category: string | null
  body: string
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client.from('knowhow_notes').insert({
    ...input,
    created_by: user?.id ?? null,
    updated_by: user?.id ?? null,
  })
  if (error) throw error
}

export async function updateKnowhowNote(id: string, patch: {
  title: string
  category: string | null
  body: string
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client.from('knowhow_notes')
    .update({ ...patch, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteKnowhowNote(id: string) {
  const { error } = await db().from('knowhow_notes').delete().eq('id', id)
  if (error) throw error
}

/* ─── 契約書作成（テンプレート差し込み）───────────── */
export type DbContract = {
  id: string
  template_key: string
  partner_name: string
  partner_address: string
  representative_name: string
  contract_date: string
  body: string
  created_by: string | null
  created_at: string
  author: { full_name: string } | null
}

export async function fetchContracts(): Promise<DbContract[]> {
  const { data, error } = await db()
    .from('contracts')
    .select('*, author:profiles!contracts_created_by_fkey(full_name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbContract[]
}

export async function insertContract(input: {
  template_key: string
  partner_name: string
  partner_address: string
  representative_name: string
  contract_date: string
  body: string
}): Promise<DbContract> {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { data, error } = await client.from('contracts')
    .insert({ ...input, created_by: user?.id ?? null })
    .select('*, author:profiles!contracts_created_by_fkey(full_name)')
    .single()
  if (error) throw error
  return data as unknown as DbContract
}

export async function deleteContract(id: string) {
  const { error } = await db().from('contracts').delete().eq('id', id)
  if (error) throw error
}

export type DbContractTemplate = {
  id: string
  key: string
  label: string
  description: string | null
  title: string
  body_template: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export async function fetchContractTemplates(): Promise<DbContractTemplate[]> {
  const { data, error } = await db()
    .from('contract_templates')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as DbContractTemplate[]
}

export async function updateContractTemplate(id: string, patch: {
  label: string
  description: string | null
  title: string
  body_template: string
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client.from('contract_templates')
    .update({ ...patch, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/* ─── 役員月報（相互閲覧可能な月次活動報告）───────────── */
export type DbMonthlyReport = {
  id: string
  user_id: string
  period: string // 'YYYY-MM-01'
  actions: string | null      // 行動
  sales: string | null        // 営業
  tasks: string | null        // タスク（完了タスクの箇条書きを反映できる）
  initiatives: string | null  // 取り組んだこと
  updated_at: string
  profiles: { full_name: string } | null
}

export type MonthlyReportInput = {
  actions: string
  sales: string
  tasks: string
  initiatives: string
}

/** 指定月（'YYYY-MM-01'）の役員月報を全件返す。RLS で役員本人・管理者のみ取得可 */
export async function fetchMonthlyReports(period: string): Promise<DbMonthlyReport[]> {
  const { data, error } = await db()
    .from('monthly_reports')
    .select('id, user_id, period, actions, sales, tasks, initiatives, updated_at, profiles(full_name)')
    .eq('period', period)
  if (error) throw error
  return (data ?? []) as unknown as DbMonthlyReport[]
}

/** 自分の月報を作成・更新（当月分を上書き）。RLS で役員本人のみ許可 */
export async function upsertMonthlyReport(period: string, input: MonthlyReportInput) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('not signed in')
  const { error } = await client
    .from('monthly_reports')
    .upsert(
      { user_id: user.id, period, ...input, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,period' }
    )
  if (error) throw error
}

/* ─── 役員会議 事前シート（相互閲覧可能・月次ではない随時ドキュメント）─── */
export type DbBoardPrepSheet = {
  id: string
  user_id: string
  ideal_future: string | null           // ① 2年後のSaludの理想像
  why_involved: string | null           // ② なぜSaludと関わるのか
  this_year_contribution: string | null // ③ 今年、自分がSaludにもたらしたいこと
  year_end_reflection: string | null    // 最後に（年末の理想状態）
  updated_at: string
  profiles: { full_name: string } | null
}

export type BoardPrepSheetInput = {
  ideal_future: string
  why_involved: string
  this_year_contribution: string
  year_end_reflection: string
}

/** 役員会議 事前シートを全件返す。RLS で役員本人・管理者のみ取得可 */
export async function fetchBoardPrepSheets(): Promise<DbBoardPrepSheet[]> {
  const { data, error } = await db()
    .from('board_prep_sheets')
    .select('id, user_id, ideal_future, why_involved, this_year_contribution, year_end_reflection, updated_at, profiles(full_name)')
  if (error) throw error
  return (data ?? []) as unknown as DbBoardPrepSheet[]
}

/** 自分の事前シートを作成・更新（1人1件）。RLS で役員本人のみ許可 */
export async function upsertBoardPrepSheet(input: BoardPrepSheetInput) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('not signed in')
  const { error } = await client
    .from('board_prep_sheets')
    .upsert(
      { user_id: user.id, ...input, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) throw error
}

/* ─── 売上台帳（堂本さんのみ・RLSでも制限）─────────────────── */
export type DbRevenueEntry = {
  id: string
  entry_date: string
  payer_name: string
  category: string
  amount_excl_tax: number
  status: 'confirmed' | 'forecast'
  payment_due_date: string | null
  payment_received_date: string | null
  memo: string | null
}

export type RevenueEntryInput = {
  entry_date: string
  payer_name: string
  category: string
  amount_excl_tax: number
  status: 'confirmed' | 'forecast'
  payment_due_date: string | null
  payment_received_date: string | null
  memo: string | null
}

export async function fetchRevenueLedger(): Promise<DbRevenueEntry[]> {
  const { data, error } = await db()
    .from('revenue_ledger')
    .select('id, entry_date, payer_name, category, amount_excl_tax, status, payment_due_date, payment_received_date, memo')
    .order('entry_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbRevenueEntry[]
}

export async function insertRevenueEntry(input: RevenueEntryInput) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client.from('revenue_ledger').insert({ ...input, created_by: user?.id ?? null })
  if (error) throw error
}

export async function updateRevenueEntry(id: string, input: RevenueEntryInput) {
  const { error } = await db().from('revenue_ledger').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteRevenueEntry(id: string) {
  const { error } = await db().from('revenue_ledger').delete().eq('id', id)
  if (error) throw error
}

/* ─── 月額契約（保守・SEO支援など毎月同額発生するもの）───────── */
export type DbRecurringContract = {
  id: string
  payer_name: string
  category: string
  monthly_amount_excl_tax: number
  start_month: string
  end_month: string | null
  last_generated_month: string | null
  memo: string | null
}

export type RecurringContractInput = {
  payer_name: string
  category: string
  monthly_amount_excl_tax: number
  start_month: string
  end_month: string | null
  memo: string | null
}

export async function fetchRecurringContracts(): Promise<DbRecurringContract[]> {
  const { data, error } = await db()
    .from('recurring_contracts')
    .select('id, payer_name, category, monthly_amount_excl_tax, start_month, end_month, last_generated_month, memo')
    .order('payer_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as DbRecurringContract[]
}

export async function insertRecurringContract(input: RecurringContractInput) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client.from('recurring_contracts').insert({ ...input, created_by: user?.id ?? null })
  if (error) throw error
}

export async function updateRecurringContract(id: string, input: RecurringContractInput) {
  const { error } = await db().from('recurring_contracts').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteRecurringContract(id: string) {
  const { error } = await db().from('recurring_contracts').delete().eq('id', id)
  if (error) throw error
}

/* ─── 売上目標設定（会社全体KGI・カテゴリ別前提、Excel「入力_前提」相当）─ */
export type DbRevenueSettings = {
  year: number
  annual_target_amount: number
  target_gross_margin_rate: number
  executive_compensation_monthly: number | null
}

export type RevenueSettingsInput = {
  annual_target_amount: number
  target_gross_margin_rate: number
  executive_compensation_monthly: number | null
}

export async function fetchRevenueSettings(year: number): Promise<DbRevenueSettings | null> {
  const { data, error } = await db()
    .from('revenue_settings')
    .select('year, annual_target_amount, target_gross_margin_rate, executive_compensation_monthly')
    .eq('year', year)
    .maybeSingle()
  if (error) throw error
  return data as DbRevenueSettings | null
}

export async function upsertRevenueSettings(year: number, input: RevenueSettingsInput) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client
    .from('revenue_settings')
    .upsert({ year, ...input, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: 'year' })
  if (error) throw error
}

export type DbRevenueCategoryTarget = {
  id: string
  year: number
  category: string
  target_count: number
  unit_price: number
  cost_rate: number
  acceptance_rate: number | null
  is_monthly: boolean
  memo: string | null
}

export type RevenueCategoryTargetInput = {
  target_count: number
  unit_price: number
  cost_rate: number
  acceptance_rate: number | null
  is_monthly: boolean
  memo: string | null
}

export async function fetchRevenueCategoryTargets(year: number): Promise<DbRevenueCategoryTarget[]> {
  const { data, error } = await db()
    .from('revenue_category_targets')
    .select('id, year, category, target_count, unit_price, cost_rate, acceptance_rate, is_monthly, memo')
    .eq('year', year)
  if (error) throw error
  return (data ?? []) as DbRevenueCategoryTarget[]
}

export async function upsertRevenueCategoryTarget(year: number, category: string, input: RevenueCategoryTargetInput) {
  const { error } = await db()
    .from('revenue_category_targets')
    .upsert({ year, category, ...input, updated_at: new Date().toISOString() }, { onConflict: 'year,category' })
  if (error) throw error
}

export function addMonths(ymd: string, n: number): string {
  const [y, m] = ymd.split('-').map(Number)
  const total = (y! * 12 + (m! - 1)) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}-01`
}

/**
 * 有効な月額契約それぞれについて、まだ売上台帳に反映していない月
 * (last_generated_month の翌月〜当月、end_month があればそこまで)を
 * revenue_ledger に自動追加し、last_generated_month を更新する。
 * 売上管理ページを開くたびに呼び出すオンデマンド同期(cron不要)。
 * 戻り値は今回追加した件数。
 */
export async function syncRecurringContracts(): Promise<number> {
  const contracts = await fetchRecurringContracts()
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const thisMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`

  let generated = 0
  for (const c of contracts) {
    let cursor = c.last_generated_month ? addMonths(c.last_generated_month, 1) : c.start_month
    const stopAt = c.end_month && c.end_month < thisMonth ? c.end_month : thisMonth
    if (cursor > stopAt) continue

    const rows: Record<string, unknown>[] = []
    while (cursor <= stopAt) {
      rows.push({
        entry_date: cursor,
        payer_name: c.payer_name,
        category: c.category,
        amount_excl_tax: c.monthly_amount_excl_tax,
        status: 'confirmed',
        memo: '月額契約より自動反映',
        created_by: user?.id ?? null,
      })
      cursor = addMonths(cursor, 1)
    }
    if (rows.length === 0) continue

    const { error: insertError } = await client.from('revenue_ledger').insert(rows)
    if (insertError) throw insertError

    const { error: updateError } = await client
      .from('recurring_contracts')
      .update({ last_generated_month: stopAt })
      .eq('id', c.id)
    if (updateError) throw updateError

    generated += rows.length
  }
  return generated
}
