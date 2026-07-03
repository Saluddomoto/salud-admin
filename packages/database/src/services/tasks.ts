import type { DbClient } from '../supabase/client'
import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatus } from '../types/task'

export async function getTask(db: DbClient, id: string): Promise<Task | null> {
  const { data, error } = await db.from('tasks').select('*').eq('id', id).single()
  if (error) return null
  return data as Task
}

export async function getTasks(
  db: DbClient,
  filters?: { status?: TaskStatus; assigned_user_id?: string; project_id?: string },
): Promise<Task[]> {
  let query = db.from('tasks').select('*').order('due_date', { ascending: true })
  if (filters?.status)           query = query.eq('status', filters.status)
  if (filters?.assigned_user_id) query = query.eq('assigned_user_id', filters.assigned_user_id)
  if (filters?.project_id)       query = query.eq('project_id', filters.project_id)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Task[]
}

export async function createTask(db: DbClient, input: CreateTaskInput): Promise<string> {
  const { data, error } = await db.from('tasks').insert(input).select('id').single()
  if (error) throw error
  return data.id
}

export async function updateTask(db: DbClient, id: string, input: UpdateTaskInput): Promise<void> {
  const { error } = await db.from('tasks').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteTask(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('tasks').delete().eq('id', id)
  if (error) throw error
}
