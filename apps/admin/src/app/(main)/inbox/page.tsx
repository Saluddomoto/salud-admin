import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = { title: 'inbox' }

export default function Page() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="inbox" description="実装中" />
      <div className="card p-12 text-center text-slate-400 text-sm">このページは実装中です</div>
    </div>
  )
}
