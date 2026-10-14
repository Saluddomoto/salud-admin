import { ImageResponse } from 'next/og'

// アイキャッチ（サムネイル）画像を 1600x900（16:9）で作る。
// 日本語フォントは、使う文字だけを Google Fonts から取得する（ファイルを同梱しない）。

const BADGE = '補助金コラム'
const FOOTER = '株式会社Salud｜補助金の申請支援'

async function loadFont(text: string): Promise<ArrayBuffer> {
  const chars = [...new Set(text)].join('')
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(chars)}`)
  ).text()
  const m = css.match(/src:\s*url\((.+?)\)\s*format\('(?:opentype|truetype)'\)/)
  if (!m) throw new Error('eyecatch: フォントのURLが取得できませんでした')
  const res = await fetch(m[1]!)
  if (!res.ok) throw new Error(`eyecatch: フォントの取得に失敗しました (${res.status})`)
  return res.arrayBuffer()
}

export async function renderEyecatch(params: { lines: string[]; sub: string }): Promise<Buffer> {
  const lines = params.lines.filter(Boolean).slice(0, 3)
  const sub = params.sub
  const font = await loadFont(BADGE + FOOTER + lines.join('') + sub)

  const img = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '90px',
          color: '#ffffff',
          backgroundImage: 'linear-gradient(135deg, #183e5c, #1f6a96)',
          fontFamily: 'NotoSansJP',
        }}
      >
        <div style={{ display: 'flex' }}>
          <div
            style={{
              display: 'flex',
              background: '#fff176',
              color: '#1c2733',
              fontSize: 34,
              padding: '14px 36px',
              borderRadius: 999,
            }}
          >
            {BADGE}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 60, flexGrow: 1 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', fontSize: 92, lineHeight: 1.4 }}>
              {l}
            </div>
          ))}
          {sub ? (
            <div style={{ display: 'flex', fontSize: 44, color: '#fff176', marginTop: 24 }}>{sub}</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: '#dce8f2' }}>{FOOTER}</div>
      </div>
    ),
    { width: 1600, height: 900, fonts: [{ name: 'NotoSansJP', data: font, weight: 700, style: 'normal' }] },
  )
  return Buffer.from(await img.arrayBuffer())
}
