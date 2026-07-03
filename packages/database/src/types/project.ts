export type ProjectStatus =
  | 'planning'
  | 'in_progress'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'completed'

export interface Project {
  id:               string
  customer_id:      string
  title:            string
  subsidy_name:     string
  status:           ProjectStatus
  assigned_user_id: string | null
  applied_amount:   number | null
  subsidy_amount:   number | null
  deadline:         string | null
  submitted_at:     string | null
  result_at:        string | null
  notes:            string | null
  created_at:       string
  updated_at:       string
}

export type CreateProjectInput = Omit<Project, 'id' | 'created_at' | 'updated_at'>
export type UpdateProjectInput = Partial<CreateProjectInput>

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning:    '準備中',
  in_progress: '申請準備中',
  submitted:   '申請済み',
  accepted:    '採択',
  rejected:    '不採択',
  completed:   '完了',
}

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, { bg: string; text: string }> = {
  planning:    { bg: 'bg-slate-100',   text: 'text-slate-600' },
  in_progress: { bg: 'bg-amber-100',   text: 'text-amber-700' },
  submitted:   { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  accepted:    { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  rejected:    { bg: 'bg-red-100',     text: 'text-red-700' },
  completed:   { bg: 'bg-slate-100',   text: 'text-slate-500' },
}
