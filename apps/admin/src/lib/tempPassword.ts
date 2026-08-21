// 管理者がメンバーの招待・パスワードリセット時に発行する一時パスワード。
// 本人に一度だけ共有し、後日メンバー自身で /settings > セキュリティ から変更してもらう想定。
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}
