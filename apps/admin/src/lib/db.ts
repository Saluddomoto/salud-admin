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
  chatwork_room_id: string | null
  created_at: string
  profiles: { full_name: string } | null
  customer_contacts: DbContact[]
  // 外部リード連携(例: hojokin-app)由来の顧客のみ設定される
  external_lead_id: string | null
  lead_source: string | null
  selected_subsidy_name: string | null
  matching_score: number | null
  matching_reason: string | null
  via_agency: boolean | null
  lead_registered_at: string | null
}

export type DbProject = {
  id: string
  title: string
  subsidy_name: string | null
  project_type: 'subsidy' | 'web'
  status: 'planning' | 'in_progress' | 'submitted' | 'accepted' | 'rejected' | 'lost' | 'completed'
  result_report_status: 'estimate_prep' | 'grant_application' | 'in_execution' | 'result_report' | null
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
  // true: 期限を設定しない「毎日のルーティンタスク」。完了状態は status ではなく
  // 日付ごとの task_completions で管理する（毎日リセットされる）。
  is_routine: boolean
  projects: { title: string } | null
  profiles: { full_name: string } | null
}

// ルーティンタスクの「その日の完了」ログ。1タスク×1日で最大1件（UNIQUE(task_id, completed_on)）。
export type DbTaskCompletion = {
  id: string
  task_id: string
  completed_on: string
  completed_by: string | null
}

export type DbDashboardSettings = {
  id: number
  zoom_url: string | null
  meet_url: string | null
  updated_at: string
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
  chatwork_account_id: string | null
  is_executive: boolean
  annual_target_amount: number | null
}

export type DbEvent = {
  id: string
  title: string
  event_date: string
  start_time: string // 'HH:MM:SS'
  end_time: string
  category: 'sales' | 'first_meeting' | 'meeting' | 'deadline' | 'internal'
  notes: string | null
  assigned_user_id: string | null
  profiles: { full_name: string } | null
}

export type DbMessage = {
  id: string
  channel: 'line' | 'email' | 'web' | 'chatwork'
  sender_name: string
  company_name: string | null
  body: string
  received_at: string
  is_read: boolean
  needs_reply: boolean
  converted_to: 'project' | 'task' | 'event' | null
  source_type: 'user' | 'group' | 'room'
  line_group_id: string | null
  chatwork_room_id: string | null
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
  chatwork_room_id?: string | null
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
  address: string
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
      address:        input.address || null,
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

// hojokin-app等の外部リードを手動で取り込む。external_lead_idが既存customerと
// 一致する場合は上書き更新、なければ新規作成する（先方からの再送・二重登録対策）。
export async function insertLeadCustomer(input: {
  external_lead_id: string
  lead_source: string
  company_name: string
  contact_name: string
  email: string | null
  phone: string | null
  industry: string | null
  employee_count: number | null
  address: string | null
  notes: string | null
  selected_subsidy_name: string | null
  matching_score: number | null
  matching_reason: string | null
  via_agency: boolean
  lead_registered_at: string | null
}): Promise<{ id: string; wasUpdate: boolean }> {
  const client = db()
  const { data: existing, error: findError } = await client
    .from('customers')
    .select('id')
    .eq('external_lead_id', input.external_lead_id)
    .maybeSingle()
  if (findError) throw findError

  const customerFields = {
    company_name:           input.company_name,
    email:                  input.email,
    phone:                  input.phone,
    industry:               input.industry,
    employee_count:         input.employee_count,
    address:                input.address,
    notes:                  input.notes,
    external_lead_id:       input.external_lead_id,
    lead_source:            input.lead_source,
    selected_subsidy_name:  input.selected_subsidy_name,
    matching_score:         input.matching_score,
    matching_reason:        input.matching_reason,
    via_agency:             input.via_agency,
    lead_registered_at:     input.lead_registered_at,
  }

  if (existing) {
    const { error } = await client.from('customers').update(customerFields).eq('id', existing.id)
    if (error) throw error
    return { id: existing.id, wasUpdate: true }
  }

  const { data, error } = await client
    .from('customers')
    .insert({ ...customerFields, status: 'prospect' })
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
  return { id: data.id, wasUpdate: false }
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

export async function updateResultReportStatus(id: string, resultReportStatus: string | null) {
  const { error } = await db().from('projects').update({ result_report_status: resultReportStatus }).eq('id', id)
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
  result_at?: string | null
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
  is_routine?: boolean
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
  is_routine?: boolean
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
  const client = db()
  const { error } = await client.from('tasks').update({ status }).eq('id', id)
  if (error) throw error
  if (status === 'done') {
    await reflectCompletedTaskInMonthlyReport(client, id).catch(() => {})
  }
}

// タスクを完了にした瞬間、担当者本人がその場で完了させた場合に限り、
// その月の役員月報「タスク」欄へ自動で箇条書きを追記する。
// monthly_reports への insert は RLS で本人（かつ役員）のみ許可されているため、
// 他人がタスクを代理完了した場合や非役員の場合は静かにスキップする
// （手動の「完了タスクを読み込む」ボタンは従来どおり別途利用可能）。
async function reflectCompletedTaskInMonthlyReport(client: ReturnType<typeof createClient>, taskId: string) {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return

  const { data: task } = await client
    .from('tasks')
    .select('title, assigned_user_id')
    .eq('id', taskId)
    .maybeSingle()
  if (!task?.title || task.assigned_user_id !== user.id) return

  const jst = new Date(Date.now() + 9 * 3600_000)
  const period = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-01`

  const { data: existing } = await client
    .from('monthly_reports')
    .select('actions, sales, tasks, initiatives')
    .eq('user_id', user.id)
    .eq('period', period)
    .maybeSingle()

  const bullet = `・${task.title}`
  const currentTasks = existing?.tasks ?? ''
  if (currentTasks.split('\n').includes(bullet)) return

  const { error } = await client.from('monthly_reports').upsert(
    {
      user_id: user.id,
      period,
      actions: existing?.actions ?? '',
      sales: existing?.sales ?? '',
      initiatives: existing?.initiatives ?? '',
      tasks: currentTasks ? `${currentTasks}\n${bullet}` : bullet,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,period' }
  )
  if (error) throw error
}

export async function updateTask(id: string, input: {
  title: string
  description?: string | null
  priority: string
  due_date: string | null
  project_id: string | null
  assigned_user_id?: string
  is_routine?: boolean
}) {
  const { error } = await db().from('tasks').update(input).eq('id', id)
  if (error) throw error
}

// ルーティンタスクの当日分の完了ログ一覧を取得する（本日のタスクの完了判定に使う）。
export async function fetchTaskCompletions(date: string): Promise<DbTaskCompletion[]> {
  const { data, error } = await db()
    .from('task_completions')
    .select('*')
    .eq('completed_on', date)
  if (error) throw error
  return data as DbTaskCompletion[]
}

// ルーティンタスクの「その日の完了」をオン/オフする（task.status は変更しない）。
export async function setTaskCompletion(taskId: string, date: string, completed: boolean) {
  const client = db()
  if (completed) {
    const { data: { user } } = await client.auth.getUser()
    const { error } = await client
      .from('task_completions')
      .upsert({ task_id: taskId, completed_on: date, completed_by: user?.id ?? null }, { onConflict: 'task_id,completed_on' })
    if (error) throw error
  } else {
    const { error } = await client
      .from('task_completions')
      .delete()
      .eq('task_id', taskId)
      .eq('completed_on', date)
    if (error) throw error
  }
}

export async function fetchDashboardSettings(): Promise<DbDashboardSettings | null> {
  const { data, error } = await db()
    .from('dashboard_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data as DbDashboardSettings | null
}

export async function updateDashboardZoomUrl(zoomUrl: string | null) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client
    .from('dashboard_settings')
    .upsert({ id: 1, zoom_url: zoomUrl, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
  if (error) throw error
}

export async function updateDashboardMeetUrl(meetUrl: string | null) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client
    .from('dashboard_settings')
    .upsert({ id: 1, meet_url: meetUrl, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
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

// 複数件をまとめて受信トレイから消す（一斉削除ボタン用）
export async function dismissMessages(ids: string[]) {
  if (ids.length === 0) return
  const { error } = await db().from('messages')
    .update({ dismissed_at: new Date().toISOString(), is_read: true, needs_reply: false })
    .in('id', ids)
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
    .select('id, full_name, role, department, is_active, notification_prefs, tasks_shared_with_team, digest_enabled, line_user_id, chatwork_account_id, is_executive, annual_target_amount')
    .order('created_at')
  if (error) throw error
  return data as DbProfile[]
}

// 役員本人（相互閲覧のため、役員が他の役員のプロフィールを読む用）
export async function fetchExecutiveProfiles(): Promise<DbProfile[]> {
  const { data, error } = await db()
    .from('profiles')
    .select('id, full_name, role, department, is_active, notification_prefs, tasks_shared_with_team, digest_enabled, line_user_id, chatwork_account_id, is_executive, annual_target_amount')
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
    .select('id, full_name, role, department, is_active, notification_prefs, tasks_shared_with_team, digest_enabled, line_user_id, chatwork_account_id, is_executive, annual_target_amount')
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

// Chatwork連携: このメンバー自身のChatworkアカウントIDを登録する（admin のみ RLS で許可）。
// Webhookでルーム内の発言者がここに登録済みのIDと一致する場合、スタッフ本人の発言として扱う。
export async function updateMemberChatworkId(id: string, chatworkAccountId: string | null) {
  const { error } = await db().from('profiles').update({ chatwork_account_id: chatworkAccountId }).eq('id', id)
  if (error) throw error
}

export type DbLoginHistory = {
  id: string
  user_id: string
  logged_in_at: string
  profiles: { full_name: string } | null
}

// ログイン履歴（admin のみ RLS で許可）。直近 limit 件をログイン日時の新しい順で返す。
export async function fetchLoginHistory(limit = 200): Promise<DbLoginHistory[]> {
  const { data, error } = await db()
    .from('login_history')
    .select('id, user_id, logged_in_at, profiles(full_name)')
    .order('logged_in_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as unknown as DbLoginHistory[]
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
  period: string | null // 'YYYY-MM-01'。役員月報の月末MTG議事録として紐付けた場合のみ設定
  created_at: string
  customers: { company_name: string } | null
  projects: { title: string } | null
}

const MEETING_NOTE_SELECT =
  'id, title, meeting_date, duration_min, host_name, recording_url, transcript, summary, customer_id, project_id, source, period, created_at, customers(company_name), projects(title)'

export async function fetchMeetingNotes(): Promise<DbMeetingNote[]> {
  const { data, error } = await db()
    .from('meeting_notes')
    .select(MEETING_NOTE_SELECT)
    .order('meeting_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbMeetingNote[]
}

/** 指定の月報期間（'YYYY-MM-01'）に紐付けられた月末MTG議事録を返す */
export async function fetchMeetingNotesByPeriod(period: string): Promise<DbMeetingNote[]> {
  const { data, error } = await db()
    .from('meeting_notes')
    .select(MEETING_NOTE_SELECT)
    .eq('period', period)
    .order('meeting_date', { ascending: false, nullsFirst: false })
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
  period?: string | null
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
  period?: string | null
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
  values: Record<string, string>
  body: string
  created_by: string | null
  created_at: string
  author: { full_name: string } | null
}

export async function fetchContracts(): Promise<DbContract[]> {
  const { data, error } = await db()
    .from('contracts')
    .select('id, template_key, values, body, created_by, created_at, author:profiles!contracts_created_by_fkey(full_name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbContract[]
}

export async function insertContract(input: {
  template_key: string
  values: Record<string, string>
  body: string
}): Promise<DbContract> {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { data, error } = await client.from('contracts')
    .insert({ ...input, created_by: user?.id ?? null })
    .select('id, template_key, values, body, created_by, created_at, author:profiles!contracts_created_by_fkey(full_name)')
    .single()
  if (error) throw error
  return data as unknown as DbContract
}

export async function deleteContract(id: string) {
  const { error } = await db().from('contracts').delete().eq('id', id)
  if (error) throw error
}

export async function updateContract(id: string, patch: {
  values: Record<string, string>
  body: string
}): Promise<DbContract> {
  const { data, error } = await db().from('contracts')
    .update(patch)
    .eq('id', id)
    .select('id, template_key, values, body, created_by, created_at, author:profiles!contracts_created_by_fkey(full_name)')
    .single()
  if (error) throw error
  return data as unknown as DbContract
}

export type DbContractTemplate = {
  id: string
  key: string
  label: string
  description: string | null
  title: string
  body_template: string
  fields: { token: string; label: string; type: 'text' | 'date' }[]
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

/* ─── 請求書発行 ───────────────────────────── */
export type InvoiceItem = {
  name: string
  work: string
  quantity: number
  unit_price: number
}

export type InvoiceDocType = 'invoice' | 'estimate'

export type DbInvoice = {
  id: string
  invoice_no: string
  doc_type: InvoiceDocType
  customer_id: string | null
  billing_name: string
  issue_date: string
  due_date: string | null
  items: InvoiceItem[]
  tax_rate: number
  notes: string
  created_by: string | null
  created_at: string
  author: { full_name: string } | null
}

export type InvoiceInput = {
  doc_type: InvoiceDocType
  customer_id: string | null
  billing_name: string
  issue_date: string
  due_date: string | null
  items: InvoiceItem[]
  tax_rate: number
  notes: string
}

const INVOICE_SELECT = 'id, invoice_no, doc_type, customer_id, billing_name, issue_date, due_date, items, tax_rate, notes, created_by, created_at, author:profiles!invoices_created_by_fkey(full_name)'

export async function fetchInvoices(): Promise<DbInvoice[]> {
  const { data, error } = await db()
    .from('invoices')
    .select(INVOICE_SELECT)
    .order('issue_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbInvoice[]
}

export async function insertInvoice(input: InvoiceInput): Promise<DbInvoice> {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { data, error } = await client.from('invoices')
    .insert({ ...input, created_by: user?.id ?? null })
    .select(INVOICE_SELECT)
    .single()
  if (error) throw error
  return data as unknown as DbInvoice
}

export async function updateInvoice(id: string, patch: InvoiceInput): Promise<DbInvoice> {
  const { data, error } = await db().from('invoices')
    .update(patch)
    .eq('id', id)
    .select(INVOICE_SELECT)
    .single()
  if (error) throw error
  return data as unknown as DbInvoice
}

export async function deleteInvoice(id: string) {
  const { error } = await db().from('invoices').delete().eq('id', id)
  if (error) throw error
}

export type DbInvoiceNoteTemplate = {
  id: string
  label: string
  body: string
  created_at: string
}

export async function fetchInvoiceNoteTemplates(): Promise<DbInvoiceNoteTemplate[]> {
  const { data, error } = await db()
    .from('invoice_note_templates')
    .select('id, label, body, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as DbInvoiceNoteTemplate[]
}

export async function insertInvoiceNoteTemplate(input: { label: string; body: string }): Promise<DbInvoiceNoteTemplate> {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { data, error } = await client.from('invoice_note_templates')
    .insert({ ...input, created_by: user?.id ?? null })
    .select('id, label, body, created_at')
    .single()
  if (error) throw error
  return data as DbInvoiceNoteTemplate
}

export async function deleteInvoiceNoteTemplate(id: string) {
  const { error } = await db().from('invoice_note_templates').delete().eq('id', id)
  if (error) throw error
}

/* ─── 役員月報（相互閲覧可能な月次活動報告）───────────── */
export type DbMonthlyReport = {
  id: string
  user_id: string
  period: string // 'YYYY-MM-01'
  actions: string | null              // 行動
  sales: string | null                // 営業
  tasks: string | null                // タスク（完了タスクの箇条書きを反映できる）
  initiatives: string | null          // 取り組んだこと
  goal_progress: string | null        // 年間目標に対する今月の進捗
  challenges: string | null           // 現在の課題
  discussion_topics: string | null    // 月末会議で議論したいこと
  next_month_actions: string | null   // 来月取り組むこと
  next_month_outcome: string | null   // 来月の成果（状態）
  support_needed: string | null       // 必要なサポート
  updated_at: string
  profiles: { full_name: string } | null
}

export type MonthlyReportInput = {
  actions: string
  sales: string
  tasks: string
  initiatives: string
  goal_progress: string
  challenges: string
  discussion_topics: string
  next_month_actions: string
  next_month_outcome: string
  support_needed: string
}

const MONTHLY_REPORT_SELECT =
  'id, user_id, period, actions, sales, tasks, initiatives, goal_progress, challenges, discussion_topics, next_month_actions, next_month_outcome, support_needed, updated_at, profiles(full_name)'

/** 指定月（'YYYY-MM-01'）の役員月報を全件返す。RLS で役員本人・管理者のみ取得可 */
export async function fetchMonthlyReports(period: string): Promise<DbMonthlyReport[]> {
  const { data, error } = await db()
    .from('monthly_reports')
    .select(MONTHLY_REPORT_SELECT)
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

/* ─── 役員月報 AI横断分析（月に1件、/api/monthly-reports/ai-summary が生成・保存） ─── */
export type DbMonthlyReportAiSummary = {
  period: string
  overview: string | null
  highlights: string[]
  risks: string[]
  discussion_agenda: string[]
  advice: string[]
  generated_by: string | null
  updated_at: string
}

/** 指定月に保存済みのAI分析結果を返す（無ければ null）。RLS で役員本人・管理者のみ取得可 */
export async function fetchMonthlyReportAiSummary(period: string): Promise<DbMonthlyReportAiSummary | null> {
  const { data, error } = await db()
    .from('monthly_report_ai_summaries')
    .select('period, overview, highlights, risks, discussion_agenda, advice, generated_by, updated_at')
    .eq('period', period)
    .maybeSingle()
  if (error) throw error
  return data as DbMonthlyReportAiSummary | null
}

/* ─── 役員月報 年間AI分析（年に1件、/api/monthly-reports/annual-ai-summary が生成・保存） ─── */
export type DbAnnualReportAiSummary = {
  year: number
  overview: string | null
  highlights: string[]
  risks: string[]
  discussion_agenda: string[]
  advice: string[]
  generated_by: string | null
  updated_at: string
}

/** 指定年に保存済みの年間AI分析結果を返す（無ければ null）。RLS で役員本人・管理者のみ取得可 */
export async function fetchAnnualReportAiSummary(year: number): Promise<DbAnnualReportAiSummary | null> {
  const { data, error } = await db()
    .from('annual_report_ai_summaries')
    .select('year, overview, highlights, risks, discussion_agenda, advice, generated_by, updated_at')
    .eq('year', year)
    .maybeSingle()
  if (error) throw error
  return data as DbAnnualReportAiSummary | null
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
  // 手入力の売上明細が「基本料金」か「成功報酬」かの区分（任意・補助金以外は未設定）。
  fee_type: 'base_fee' | 'success_fee' | null
  // 顧客管理（customers）との紐付け（任意）
  customer_id: string | null
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
  fee_type?: 'base_fee' | 'success_fee' | null
  customer_id?: string | null
}

export async function fetchRevenueLedger(): Promise<DbRevenueEntry[]> {
  // fee_type 列はマイグレーション未適用の環境でも壊れないよう select('*') にしている
  // （個別カラム指定だと未追加の列名で 400 エラーになるため）。
  const { data, error } = await db()
    .from('revenue_ledger')
    .select('*')
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

/* ─── 代理店登録管理表（募集フォーム自動取込＋手動追加、全員が読み書き自由）─── */
export type DbPartnerAgency = {
  id: string
  source: 'form' | 'manual' | 'legacy_sheet'
  form_timestamp: string | null
  company_name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  hp_url: string | null
  address: string | null
  business_description: string | null
  customer_count: string | null
  sales_staff_count: string | null
  customer_industries: string | null
  customer_regions: string | null
  desired_collaboration: string | null
  desired_support: string | null
  seminar_cooperation: string | null
  seminar_reachable_count: string | null
  annual_referral_estimate: string | null
  has_current_prospects: string | null
  target_customer_profile: string | null
  meeting_notes: string | null
  info_delivery_method: string | null
  note: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  author: { full_name: string } | null
  editor: { full_name: string } | null
}

export async function fetchPartnerAgencies(): Promise<DbPartnerAgency[]> {
  const { data, error } = await db()
    .from('partner_agencies')
    .select('*, author:profiles!partner_agencies_created_by_fkey(full_name), editor:profiles!partner_agencies_updated_by_fkey(full_name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbPartnerAgency[]
}

export async function insertPartnerAgency(input: {
  company_name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  hp_url: string | null
  address: string | null
  note: string | null
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client.from('partner_agencies').insert({
    ...input,
    source: 'manual',
    created_by: user?.id ?? null,
    updated_by: user?.id ?? null,
  })
  if (error) throw error
}

export async function updatePartnerAgency(id: string, patch: {
  company_name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  hp_url: string | null
  address: string | null
  note: string | null
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client.from('partner_agencies')
    .update({ ...patch, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deletePartnerAgency(id: string) {
  const { error } = await db().from('partner_agencies').delete().eq('id', id)
  if (error) throw error
}

// ── 補助金プログラムの公募締切（案件と紐づかない、制度そのものの締切） ──────
export type DbSubsidyProgramDeadline = {
  id: string
  program_name: string
  ministry: string | null
  round_label: string | null
  deadline_date: string
  notes: string | null
}

export async function fetchSubsidyProgramDeadlines(): Promise<DbSubsidyProgramDeadline[]> {
  const { data, error } = await db()
    .from('subsidy_program_deadlines')
    .select('id, program_name, ministry, round_label, deadline_date, notes')
    .order('deadline_date', { ascending: true })
  if (error) throw error
  return data as DbSubsidyProgramDeadline[]
}

export async function insertSubsidyProgramDeadline(input: {
  program_name: string
  ministry: string | null
  round_label: string | null
  deadline_date: string
  notes: string | null
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client.from('subsidy_program_deadlines').insert({
    ...input,
    created_by: user?.id ?? null,
  })
  if (error) throw error
}

export async function deleteSubsidyProgramDeadline(id: string) {
  const { error } = await db().from('subsidy_program_deadlines').delete().eq('id', id)
  if (error) throw error
}
