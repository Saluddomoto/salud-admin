// 認証Cookieの有効期限を明示的に固定する（スマホでログイン状態を保持するため）。
// ブラウザが許容する上限は約400日（Chrome/Safari とも）。
// @supabase/ssr のデフォルトも 400 日だが、将来の変更に左右されないよう明示指定する。
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 400 // 400日（秒）

export const AUTH_COOKIE_OPTIONS = {
  maxAge: AUTH_COOKIE_MAX_AGE,
} as const
