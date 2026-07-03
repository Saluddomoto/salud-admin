import type { DbClient } from '../supabase/client'
import type { Project, CreateProjectInput, UpdateProjectInput, ProjectStatus } from '../types/project'

export async function getProject(db: DbClient, id: string): Promise<Project | null> {
  const { data, error } = await db.from('projects').select('*').eq('id', id).single()
  if (error) return null
  return data as Project
}

export async function getProjects(
  db: DbClient,
  filters?: { status?: ProjectStatus; customer_id?: string; assigned_user_id?: string },
): Promise<Project[]> {
  let query = db.from('projects').select('*').order('created_at', { ascending: false })
  if (filters?.status)           query = query.eq('status', filters.status)
  if (filters?.customer_id)      query = query.eq('customer_id', filters.customer_id)
  if (filters?.assigned_user_id) query = query.eq('assigned_user_id', filters.assigned_user_id)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Project[]
}

export async function createProject(db: DbClient, input: CreateProjectInput): Promise<string> {
  const { data, error } = await db.from('projects').insert(input).select('id').single()
  if (error) throw error
  return data.id
}

export async function updateProject(db: DbClient, id: string, input: UpdateProjectInput): Promise<void> {
  const { error } = await db.from('projects').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteProject(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('projects').delete().eq('id', id)
  if (error) throw error
}
