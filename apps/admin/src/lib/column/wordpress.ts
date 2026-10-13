// salud-web.jp（WordPress）への下書き保存。アプリケーションパスワードで REST API を呼ぶ。
// 公開は絶対にしない（status は常に 'draft'）。公開は人が確認してから行う。

const WP_BASE = 'https://salud-web.jp/wp-json/wp/v2'
const COLUMN_CATEGORY_ID = 19 // 補助金コラム

function authHeader(): string {
  const user = process.env.WP_USER
  const pass = process.env.WP_APP_PASSWORD
  if (!user || !pass) throw new Error('WP_USER / WP_APP_PASSWORD が未設定です')
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
}

/** 公開済みコラムのタイトル一覧（認証不要）。重複する切り口を避けるために使う。下書き分は column_drafts 側で補う */
export async function fetchColumnTitles(): Promise<string[]> {
  const url = `${WP_BASE}/posts?categories=${COLUMN_CATEGORY_ID}&per_page=100&_fields=title`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`WordPress 記事一覧の取得に失敗しました (${res.status})`)
  const rows = (await res.json()) as { title: { rendered: string } }[]
  return rows.map(r => r.title.rendered.replace(/&amp;/g, '&').replace(/&#\d+;/g, ''))
}

export async function createDraftPost(params: {
  title: string
  slug: string
  excerpt: string
  html: string
}): Promise<{ id: number; editUrl: string }> {
  const res = await fetch(`${WP_BASE}/posts`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: params.title,
      slug: params.slug,
      excerpt: params.excerpt,
      content: params.html,
      status: 'draft',
      categories: [COLUMN_CATEGORY_ID],
    }),
  })
  if (!res.ok) throw new Error(`WordPress 下書きの作成に失敗しました (${res.status}) ${(await res.text()).slice(0, 200)}`)
  const post = (await res.json()) as { id: number }
  return { id: post.id, editUrl: `https://salud-web.jp/wp-admin/post.php?post=${post.id}&action=edit` }
}
