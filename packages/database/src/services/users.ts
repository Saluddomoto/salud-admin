import type { DbClient } from '../supabase/client'
import type { Profile, UpdateProfileInput } from '../types/user'

export async function getProfile(db: DbClient, id: string): Promise<Profile | null> {
  const { data, error } = await db.from('profiles').select('*').eq('id', id).single()
  if (error) return null
  return data as Profile
}

export async function getProfiles(db: DbClient): Promise<Profile[]> {
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .order('full_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function updateProfile(db: DbClient, id: string, input: UpdateProfileInput): Promise<void> {
  const { error } = await db.from('profiles').update(input).eq('id', id)
  if (error) throw error
}
