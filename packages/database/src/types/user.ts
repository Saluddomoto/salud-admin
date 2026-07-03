export type UserRole = 'admin' | 'manager' | 'staff' | 'customer'

export interface Profile {
  id:            string
  full_name:     string
  full_name_kana: string
  role:          UserRole
  department:    string | null
  avatar_url:    string | null
  line_user_id:  string | null
  is_active:     boolean
  created_at:    string
  updated_at:    string
}

export type CreateProfileInput = Omit<Profile, 'id' | 'created_at' | 'updated_at'>
export type UpdateProfileInput = Partial<CreateProfileInput>
