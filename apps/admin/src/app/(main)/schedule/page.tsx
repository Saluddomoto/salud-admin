'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { fetchEvents, insertEvent, type DbEvent } from '@/lib/db'

const WEEK_DAYS = ['月', '火', '水', '木', '金', '土', '日']

const CATEGORY_META: Record<DbEvent['category'], { label: string; color: string; cls: string }> = {
  sales:    { label: '商談', color: '#f59e0b', cls: 'bg-amber-100 text-amber-700' },
  meeting:  { label: '面談', color: '#6366f1', cls: 'bg-indigo-100 text-indigo-700' },
  deadline: { label: '締切', color: '#ef4444', cls: 'bg-rose-100 text-rose-700' },
  internal: { label: '社内', color: '#64748b', cls: 'bg-slate-100 text-slate-600' },
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** その週の月曜日を返す */
function mondayOf(d: Date): Date {
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return monday
}

const fmtTime = (t: string) => t.slice(0, 5)

export default function SchedulePage() {
  const [events,   setEvents]   = useState<DbEvent[]>([])
  const [loading,  setLoading]  = useState(true)
  const [category, setCategory] = useState('')
  const [assignee, setAssignee] = useState('')
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [modalOpen, setModalOpen] = useState(false)
  const [saving,    setSaving]    = useState(false)

  const today = toISODate(new Date())
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return toISODate(d)
    }),
    [weekStart],
  )

  const weekFrom = weekDates[0]!
  const weekTo   = weekDates[6]!

  const load = useCallback(() => {
    setLoading(true)
    fetchEvents(weekFrom, weekTo)
      .then(setEvents)
      .finally(() => setLoading(false))
  }, [weekFrom, weekTo])

  useEffect(load, [load])

  const moveWeek = (weeks: number) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + weeks * 7)
    setWeekStart(d)
  }

  const assignees = [...new Set(events.map(e => e.profiles?.full_name).filter(Boolean))] as string[]

  const filtered = events.filter(e => {
    if (category && e.category !== category) return false
    if (assignee && e.profiles?.full_name !== assignee) return false
    return true
  })

  const rangeLabel = `${weekFrom.replace(/-/g, '/')} 〜 ${weekTo.slice(5).replace('-', '/')}`

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    const f = new FormData(ev.currentTarget)
    setSaving(true)
    try {
      await insertEvent({
        title:      String(f.get('title')),
        event_date: String(f.get('event_date')),
        start_time: String(f.get('start_time')),
        end_time:   String(f.get('end_time') || f.get('start_time')),
        category:   String(f.get('category')),
        notes:      String(f.get('notes')) || null,
      })
      setModalOpen(false)
      load()
    } catch (e) {
      alert(`保存に失敗しました: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="スケジュール" description={rangeLabel}>
        <div className="flex items-center gap-1">
          <button className="btn-secondary px-2.5 text-sm" onClick={() => moveWeek(-1)}>◀</button>
          <button className="btn-secondary text-sm" onClick={() => setWeekStart(mondayOf(new Date()))}>今週</button>
          <button className="btn-secondary px-2.5 text-sm" onClick={() => moveWeek(1)}>▶</button>
        </div>
        <select className="input w-32 text-sm" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">全カテゴリ</option>
          {Object.entries(CATEGORY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <select className="input w-32 text-sm" value={assignee} onChange={e => setAssignee(e.target.value)}>
          <option value="">全員</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>+ 予定を追加</button>
      </PageHeader>

      {/* 週カレンダー */}
      <div className="card grid grid-cols-7 divide-x divide-slate-100 overflow-hidden">
        {weekDates.map((date, i) => {
          const dayEvents = filtered.filter(e => e.event_date === date)
          const isToday = date === today
          const isWeekend = i >= 5

          return (
            <div key={date} className={`min-h-[420px] ${isToday ? 'bg-brand-50/50' : isWeekend ? 'bg-slate-50/50' : ''}`}>
              <div className={`border-b border-slate-100 px-3 py-2.5 text-center ${isToday ? 'bg-brand-600 text-white' : ''}`}>
                <p className={`text-xs ${isToday ? 'text-brand-100' : 'text-slate-400'}`}>{WEEK_DAYS[i]}</p>
                <p className={`text-lg font-bold ${isToday ? 'text-white' : isWeekend ? 'text-slate-400' : 'text-slate-800'}`}>
                  {parseInt(date.slice(8), 10)}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 p-2">
                {dayEvents.map(e => {
                  const meta = CATEGORY_META[e.category]
                  return (
                    <div
                      key={e.id}
                      className="cursor-pointer rounded-lg border-l-[3px] bg-white p-2 shadow-sm transition-shadow hover:shadow"
                      style={{ borderLeftColor: meta.color }}
                      title={e.notes ?? undefined}
                    >
                      <p className="text-xs font-semibold leading-snug text-slate-800">{e.title}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {e.start_time === e.end_time
                          ? fmtTime(e.start_time)
                          : `${fmtTime(e.start_time)}–${fmtTime(e.end_time)}`} · {e.profiles?.full_name ?? '—'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 今後の予定リスト */}
      <div className="card p-5">
        <h3 className="mb-4 font-semibold text-slate-900">今週の予定</h3>
        {loading && <p className="py-8 text-center text-sm text-slate-400">読み込み中...</p>}
        {!loading && filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">この週の予定はありません</p>
        )}
        <div className="space-y-2">
          {filtered.map(e => {
            const meta = CATEGORY_META[e.category]
            return (
              <div key={e.id} className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50">
                <div className="h-10 w-1 flex-shrink-0 rounded-full" style={{ background: meta.color }} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{e.title}</p>
                  <p className="text-xs text-slate-400">
                    {e.event_date.slice(5).replace('-', '/')}{' '}
                    {e.start_time === e.end_time
                      ? fmtTime(e.start_time)
                      : `${fmtTime(e.start_time)}–${fmtTime(e.end_time)}`}
                  </p>
                </div>
                <span className={`badge text-xs ${meta.cls}`}>{meta.label}</span>
                <span className="w-16 truncate text-right text-xs text-slate-500">{e.profiles?.full_name ?? '—'}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 予定追加モーダル */}
      <Modal title="予定を追加" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">件名 *</label>
            <input name="title" required className="input" placeholder="例: 山田製作所 打ち合わせ" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">日付 *</label>
              <input name="event_date" type="date" required defaultValue={today} className="input" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">カテゴリ</label>
              <select name="category" className="input" defaultValue="meeting">
                {Object.entries(CATEGORY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">開始 *</label>
              <input name="start_time" type="time" required defaultValue="10:00" className="input" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">終了</label>
              <input name="end_time" type="time" defaultValue="11:00" className="input" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">メモ</label>
            <textarea name="notes" rows={2} className="input" />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary text-sm" onClick={() => setModalOpen(false)}>キャンセル</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
