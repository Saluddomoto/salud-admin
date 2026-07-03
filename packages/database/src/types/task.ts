export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus   = 'todo' | 'in_progress' | 'done'

export interface Task {
  id:               string
  project_id:       string | null
  customer_id:      string | null
  title:            string
  description:      string | null
  status:           TaskStatus
  priority:         TaskPriority
  assigned_user_id: string | null
  due_date:         string | null
  created_by:       string | null
  created_at:       string
  updated_at:       string
}

export type CreateTaskInput = Omit<Task, 'id' | 'created_at' | 'updated_at'>
export type UpdateTaskInput = Partial<CreateTaskInput>

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low:    '低',
  medium: '中',
  high:   '高',
}

export const TASK_PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string }> = {
  low:    { bg: 'bg-slate-100',  text: 'text-slate-500' },
  medium: { bg: 'bg-amber-100',  text: 'text-amber-700' },
  high:   { bg: 'bg-red-100',    text: 'text-red-700' },
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo:        '未着手',
  in_progress: '進行中',
  done:        '完了',
}
