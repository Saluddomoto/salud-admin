import type { JizokukaCaseStatus } from '@/lib/jizokuka/db'

const STATUS_META: Record<JizokukaCaseStatus, { label: string; cls: string }> = {
  draft:     { label: '下書き',     cls: 'bg-slate-100 text-slate-600' },
  review:    { label: 'レビュー中', cls: 'bg-amber-100 text-amber-700' },
  confirmed: { label: '確定',       cls: 'bg-emerald-100 text-emerald-700' },
}

export function StatusPill({ status }: { status: JizokukaCaseStatus }) {
  const meta = STATUS_META[status]
  return <span className={`badge ${meta.cls}`}>{meta.label}</span>
}
