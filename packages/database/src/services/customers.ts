import type { DbClient } from '../supabase/client'
import type { Customer, CustomerContact, CreateCustomerInput, UpdateCustomerInput, CreateContactInput, UpdateContactInput, CustomerStatus } from '../types/customer'

export async function getCustomer(db: DbClient, id: string): Promise<Customer | null> {
  const { data, error } = await db.from('customers').select('*').eq('id', id).single()
  if (error) return null
  return data as Customer
}

export async function getCustomers(
  db: DbClient,
  filters?: { status?: CustomerStatus; assigned_user_id?: string },
): Promise<Customer[]> {
  let query = db.from('customers').select('*').order('company_name_kana', { ascending: true })
  if (filters?.status)           query = query.eq('status', filters.status)
  if (filters?.assigned_user_id) query = query.eq('assigned_user_id', filters.assigned_user_id)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Customer[]
}

export async function createCustomer(db: DbClient, input: CreateCustomerInput): Promise<string> {
  const { data, error } = await db.from('customers').insert(input).select('id').single()
  if (error) throw error
  return data.id
}

export async function updateCustomer(db: DbClient, id: string, input: UpdateCustomerInput): Promise<void> {
  const { error } = await db.from('customers').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteCustomer(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('customers').delete().eq('id', id)
  if (error) throw error
}

export async function getContacts(db: DbClient, customerId: string): Promise<CustomerContact[]> {
  const { data, error } = await db
    .from('customer_contacts')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_primary', { ascending: false })
  if (error) throw error
  return (data ?? []) as CustomerContact[]
}

export async function createContact(db: DbClient, input: CreateContactInput): Promise<string> {
  const { data, error } = await db.from('customer_contacts').insert(input).select('id').single()
  if (error) throw error
  return data.id
}

export async function updateContact(db: DbClient, contactId: string, input: UpdateContactInput): Promise<void> {
  const { error } = await db.from('customer_contacts').update(input).eq('id', contactId)
  if (error) throw error
}

export async function deleteContact(db: DbClient, contactId: string): Promise<void> {
  const { error } = await db.from('customer_contacts').delete().eq('id', contactId)
  if (error) throw error
}
