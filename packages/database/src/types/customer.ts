export type CustomerStatus = 'prospect' | 'active' | 'inactive'

export interface Customer {
  id:               string
  company_name:     string
  company_name_kana: string
  industry:         string | null
  employee_count:   number | null
  annual_revenue:   number | null
  status:           CustomerStatus
  assigned_user_id: string | null
  postal_code:      string | null
  address:          string | null
  phone:            string | null
  website:          string | null
  notes:            string | null
  created_at:       string
  updated_at:       string
}

export interface CustomerContact {
  id:          string
  customer_id: string
  name:        string
  name_kana:   string | null
  title:       string | null
  email:       string | null
  phone:       string | null
  is_primary:  boolean
  created_at:  string
  updated_at:  string
}

export type CreateCustomerInput   = Omit<Customer, 'id' | 'created_at' | 'updated_at'>
export type UpdateCustomerInput   = Partial<CreateCustomerInput>
export type CreateContactInput    = Omit<CustomerContact, 'id' | 'created_at' | 'updated_at'>
export type UpdateContactInput    = Partial<CreateContactInput>
