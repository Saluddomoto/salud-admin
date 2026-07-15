import crypto from 'crypto'

// Zoom Server-to-Server OAuth でアクセストークンを取得（クラウド録画・文字起こしのダウンロード用）
export async function getZoomAccessToken(): Promise<string | null> {
  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId  = process.env.ZOOM_CLIENT_ID
  const secret    = process.env.ZOOM_CLIENT_SECRET
  if (!accountId || !clientId || !secret) return null

  const basic = Buffer.from(`${clientId}:${secret}`).toString('base64')
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    { method: 'POST', headers: { Authorization: `Basic ${basic}` } },
  )
  if (!res.ok) {
    console.error('Zoom: token fetch failed', res.status, await res.text().catch(() => ''))
    return null
  }
  const json = (await res.json()) as { access_token?: string }
  return json.access_token ?? null
}

// Webhook 署名検証（Zoom の x-zm-signature: "v0={hmac}"）
export function verifyZoomSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secretToken: string,
): boolean {
  if (!signature || !timestamp) return false
  const message = `v0:${timestamp}:${rawBody}`
  const hash = crypto.createHmac('sha256', secretToken).update(message).digest('hex')
  const expected = `v0=${hash}`
  // 長さ違いは timingSafeEqual が投げるので先にガード
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// Webhook URL 検証チャレンジ（endpoint.url_validation）への応答値を作る
export function zoomUrlValidation(plainToken: string, secretToken: string) {
  const encryptedToken = crypto.createHmac('sha256', secretToken).update(plainToken).digest('hex')
  return { plainToken, encryptedToken }
}

// Zoom の文字起こし（.vtt）を読みやすいテキストへ整形
// 例: "0\n00:00:01.000 --> 00:00:04.000\n田中: よろしくお願いします" → "田中: よろしくお願いします"
export function parseVtt(vtt: string): string {
  const lines = vtt.replace(/\r/g, '').split('\n')
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (t === 'WEBVTT') continue
    if (t.startsWith('NOTE')) continue
    if (t.includes('-->')) continue          // タイムスタンプ行
    if (/^\d+$/.test(t)) continue             // キュー番号
    if (out[out.length - 1] === t) continue   // 直近の重複を除去
    out.push(t)
  }
  return out.join('\n')
}

// 録画ファイル一覧から文字起こし(.vtt)を1件取得して整形テキストで返す
export async function fetchTranscriptText(
  recordingFiles: { file_type?: string; download_url?: string; file_extension?: string }[],
  downloadToken: string | null,
): Promise<string | null> {
  const file = recordingFiles.find(
    f => f.file_type === 'TRANSCRIPT' || f.file_extension === 'VTT',
  )
  if (!file?.download_url) return null

  const token = downloadToken ?? (await getZoomAccessToken())
  if (!token) return null

  const res = await fetch(file.download_url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    console.error('Zoom: transcript download failed', res.status)
    return null
  }
  return parseVtt(await res.text())
}
