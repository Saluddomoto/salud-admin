import type { UserRole } from '@salud/database'

/**
 * RBAC（Role-Based Access Control）権限定義
 *
 * 権限マトリクス:
 * ┌──────────────┬───────┬─────────┬───────┐
 * │ 操作         │ staff │ manager │ admin │
 * ├──────────────┼───────┼─────────┼───────┤
 * │ データ読み取り│  ✅   │   ✅    │  ✅   │
 * │ データ作成   │  ✅   │   ✅    │  ✅   │
 * │ データ更新   │  ✅   │   ✅    │  ✅   │
 * │ データ削除   │  ❌   │   ✅    │  ✅   │
 * │ ユーザー管理 │  ❌   │   ❌    │  ✅   │
 * │ 設定変更     │  ❌   │   ❌    │  ✅   │
 * └──────────────┴───────┴─────────┴───────┘
 */

/** 権限定義 */
export const PERMISSIONS = {
  // データ操作
  READ:        ['staff', 'manager', 'admin'] as UserRole[],
  CREATE:      ['staff', 'manager', 'admin'] as UserRole[],
  UPDATE:      ['staff', 'manager', 'admin'] as UserRole[],
  DELETE:      ['manager', 'admin']          as UserRole[],
  // 管理操作
  MANAGE_USERS:    ['admin'] as UserRole[],
  MANAGE_SETTINGS: ['admin'] as UserRole[],
  // データエクスポート
  EXPORT:      ['manager', 'admin'] as UserRole[],
} as const

/** 指定ロールが権限を持つか確認 */
export function hasPermission(
  role: UserRole,
  permission: keyof typeof PERMISSIONS,
): boolean {
  return (PERMISSIONS[permission] as UserRole[]).includes(role)
}

/** ロールの優先順位（数値が大きいほど上位） */
export const ROLE_PRIORITY: Record<UserRole, number> = {
  customer: 0, // 顧客ポータル用（社内データへの権限なし）
  staff:    1,
  manager:  2,
  admin:    3,
}

/** roleA が roleB 以上の権限を持つか */
export function isRoleAtLeast(roleA: UserRole, roleB: UserRole): boolean {
  return ROLE_PRIORITY[roleA] >= ROLE_PRIORITY[roleB]
}
