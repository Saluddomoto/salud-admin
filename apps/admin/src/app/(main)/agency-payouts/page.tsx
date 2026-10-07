import { redirect } from 'next/navigation'

// 代理店ご紹介料は売上管理のタブに移動した（旧URLの互換用）
export default function AgencyPayoutsRedirect() {
  redirect('/revenue?tab=referral')
}
