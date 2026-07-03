import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type DbClient = SupabaseClient

export function createDbClient(supabaseUrl: string, supabaseKey: string): DbClient {
  return createClient(supabaseUrl, supabaseKey)
}
