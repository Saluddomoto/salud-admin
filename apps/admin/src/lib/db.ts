// Supabase データアクセス層（クライアントサイド）
// RLS がロールに応じてアクセス制御するため、ここでは権限チェック不要
import { createClient } from '@/lib/supabase'

export type DbCustomer = {
  id: string
  company_name: string
  company_name_kana: string
  industry: string | null
  employee_count: number | null
  status: 'active' | 'prospect' | 'inactive'
  assigned_user_id: string | null
  phone: string | null
  notes: string | null
  created_at: string
  profiles: { full_name: string } | null
  customer_contacts: { name: string; is_primary: boolean }[]
}

export type DbProject = {
  id: string
  title: string
  subsidy_name: string
  status: 'planning' | 'in_progress' | 'submitted' | 'accepted' | 'rejected' | 'completed'
  applied_amount: number | null
  deadline: string | null
  customer_id: string
  customers: { company_name: string } | null
  profiles: { full_name: string } | null
}

export type DbTask = {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  project_id: string | null
  projects: { title: string } | null
  profiles: { full_name: string } | null
}

export type DbProfile = {
  id: string
  full_name: string
  role: string
  department: string | null
  is_active: boolean
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
  converted_to: 'project' | 'task' | 'event' | null
}

const db = () => createClient()

// ── 顧客 ─────────────────────────────────────────────
export async function fetchCustomers(): Promise<DbCustomer[]> {
  const { data, error } = await db()
    .from('customers')
    .select('*, profiles(full_name), customer_contacts(name, is_primary)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as DbCustomer[]
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
    .select('*, customers(company_name), profiles(full_name)')
    .order('deadline', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as DbProject[]
}

export async function insertProject(input: {
  title: string
  subsidy_name: string
  customer_id: string
  applied_amount: number | null
  deadline: string | null
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client.from('projects').insert({
    ...input,
    status: 'planning',
    assigned_user_id: user?.id ?? null,
  })
  if (error) throw error
}

export async function updateProjectStatus(id: string, status: string) {
  const { error } = await db().from('projects').update({ status }).eq('id', id)
  if (error) throw error
}

// ── タスク ───────────────────────────────────────────
export async function fetchTasks(): Promise<DbTask[]> {
  const { data, error } = await db()
    .from('tasks')
    .select('*, projects(title), profiles!tasks_assigned_user_id_fkey(full_name)')
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as DbTask[]
}

export async function insertTask(input: {
  title: string
  priority: string
  due_date: string | null
  project_id: string | null
}) {
  const client = db()
  const { data: { user } } = await client.auth.getUser()
  const { error } = await client.from('tasks').insert({
    ...input,
    status: 'todo',
    assigned_user_id: user?.id ?? null,
    created_by: user?.id ?? null,
  })
  if (error) throw error
}

export async function updateTaskStatus(id: string, status: string) {
  const { error } = await db().from('tasks').update({ status }).eq('id', id)
  if (error) throw error
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
    .order('received_at', { ascending: false })
  if (error) throw error
  return data as DbMessage[]
}

export async function markMessageRead(id: string) {
  const { error } = await db().from('messages').update({ is_read: true }).eq('id', id)
  if (error) throw error
}

// ── メンバー ─────────────────────────────────────────
export async function fetchProfiles(): Promise<DbProfile[]> {
  const { data, error } = await db()
    .from('profiles')
    .select('id, full_name, role, department, is_active')
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
    .select('id, full_name, role, department, is_active')
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

// ── ダッシュボード ───────────────────────────────────
export async function fetchCustomerCount(): Promise<number> {
  const { count, error } = await db()
    .from('customers')
    .select('id', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
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
