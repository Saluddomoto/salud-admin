import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = { title: 'ダッシュボード' }

const KPI_CARDS = [
  { label: '管理中の案件', value: '48', sub: '先月比 +5件', badge: '↑ 12%', badgeColor: 'bg-emerald-100 text-emerald-700', iconBg: 'bg-brand-600' },
  { label: '今期申請総額', value: '¥2.4億', sub: '採択予定 ¥1.8億', badge: '↑ 23%', badgeColor: 'bg-emerald-100 text-emerald-700', iconBg: 'bg-emerald-500' },
  { label: '顧客数', value: '127', sub: '今月 +3社', badge: '↑ 8%', badgeColor: 'bg-emerald-100 text-emerald-700', iconBg: 'bg-amber-500' },
  { label: '採択実績', value: '44件', sub: '採択率 92.3%', badge: '92%', badgeColor: 'bg-emerald-100 text-emerald-700', iconBg: 'bg-rose-500' },
]

const ALERTS = [
  { name: '株式会社山田製作所', subsidy: 'ものづくり補助金 第17回', days: 3,  color: 'text-rose-700',  dot: 'bg-rose-500' },
  { name: '有限会社鈴木商店',   subsidy: 'IT導入補助金 2025',       days: 8,  color: 'text-amber-700', dot: 'bg-amber-500' },
  { name: '合同会社テックス',   subsidy: '小規模事業者持続化補助金', days: 13, color: 'text-amber-600', dot: 'bg-amber-400' },
]

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="ダッシュボード"
        description={`2026年6月28日（土）— おはようございます`}
      >
        <button className="btn-secondary text-sm">レポート</button>
        <button className="btn-primary text-sm">新規案件</button>
      </PageHeader>

      {/* 期限アラート */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">補助金申請期限アラート（14日以内）</p>
            <div className="mt-2 space-y-1.5">
              {ALERTS.map(a => (
                <div key={a.name} className="flex items-center gap-2 text-sm text-amber-800">
                  <span className={`h-2 w-2 rounded-full ${a.dot}`} />
                  <span className="font-medium">{a.name}</span>
                  <span className="text-amber-600">— {a.subsidy}</span>
                  <span className={`ml-auto font-semibold ${a.color}`}>残り {a.days}日</span>
                </div>
              ))}
            </div>
          </div>
          <button className="text-sm font-medium text-amber-700 whitespace-nowrap hover:underline">
            すべて確認 →
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4">
        {KPI_CARDS.map(card => (
          <div key={card.label} className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}>
                <div className="h-5 w-5 rounded bg-white/30" />
              </div>
              <span className={`badge text-xs font-semibold ${card.badgeColor}`}>{card.badge}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-1 text-xs text-slate-400">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* 下段 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 最近の活動 */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">最近の活動</h3>
            <button className="text-xs font-medium text-brand-600 hover:underline">すべて見る</button>
          </div>
          <div className="space-y-3 text-sm">
            {[
              { label: '書類をアップロードしました', sub: '山田製作所 / ものづくり補助金 · 2時間前', bg: 'bg-brand-100 text-brand-600' },
              { label: '採択通知を受領',             sub: '株式会社ABC / IT導入補助金 · 昨日',       bg: 'bg-emerald-100 text-emerald-600' },
              { label: '新規顧客を登録',             sub: '合同会社テックス · 2日前',               bg: 'bg-amber-100 text-amber-600' },
            ].map(act => (
              <div key={act.label} className="flex gap-3">
                <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${act.bg}`}>
                  <div className="h-4 w-4 rounded bg-current opacity-40" />
                </div>
                <div>
                  <p className="text-slate-800">{act.label}</p>
                  <p className="text-xs text-slate-400">{act.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 今日の予定 */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">今日の予定</h3>
            <button className="text-xs font-medium text-brand-600 hover:underline">カレンダーへ →</button>
          </div>
          <div className="space-y-2">
            {[
              { time: '09:00–09:30', title: '朝礼・進捗確認', color: '#64748b' },
              { time: '14:00–15:30', title: '山田製作所 書類最終確認', color: '#6366f1' },
              { time: '16:30–17:00', title: 'IT補助金 電話相談（鈴木商店）', color: '#f59e0b' },
            ].map(ev => (
              <div key={ev.title} className="flex items-center gap-2.5 rounded-xl p-2.5 hover:bg-slate-50">
                <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: ev.color }} />
                <div>
                  <p className="text-sm font-medium text-slate-800">{ev.title}</p>
                  <p className="text-xs text-slate-400">{ev.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 本日のタスク */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">本日のタスク</h3>
            <button className="text-xs font-medium text-brand-600 hover:underline">すべて見る</button>
          </div>
          <div className="space-y-2">
            {[
              { title: 'ものづくり補助金 申請書類の最終確認', sub: '山田製作所', priority: '高', done: false },
              { title: 'IT導入補助金 見積書の収集',           sub: '鈴木商店',   priority: '中', done: false },
              { title: '週次ミーティングの議事録作成',         sub: '完了',       priority: '低', done: true },
            ].map(t => (
              <div key={t.title} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  defaultChecked={t.done}
                  className="rounded border-slate-300 text-brand-600"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${t.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {t.title}
                  </p>
                  <p className={`text-xs ${t.done ? 'text-slate-300' : 'text-slate-400'}`}>{t.sub}</p>
                </div>
                <span className={`badge text-xs flex-shrink-0 ${
                  t.priority === '高' ? 'bg-rose-100 text-rose-700' :
                  t.priority === '中' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                }`}>{t.priority}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>1/3 タスク完了</span>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/3 rounded-full bg-brand-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
