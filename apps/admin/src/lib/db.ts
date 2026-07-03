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

export type DbProfile = { id: string; full_name: string; role: string }

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
