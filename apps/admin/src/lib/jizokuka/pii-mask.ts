// ヒアリングメモをAIへ送る前に、個人情報を記号に置き換える（AIには実データを渡さない）。
// 振り分け結果は unmask() で元の文字に戻して画面へ返す。
// 氏名は一般の文章中では判別できないため、案件に登録済みの代表者名・事業者名だけを伏せる。

export interface Direct {
  target: 'basic'
  key: string
  label: string
  value: string
}

export interface MaskResult {
  masked: string
  tokens: Map<string, string>
  /** AIを通さず、プログラムで直接振り分ける項目（確実に1件だけ見つかったもの） */
  direct: Direct[]
}

const BIRTH_KEYWORD = /(生年月日|誕生日|生まれ)/
const DATE = /(?:(?:昭和|平成|令和|[SHR])\s*\d{1,2}|(?:19|20)\d{2})\s*(?:年|[/.-])\s*\d{1,2}\s*(?:月|[/.-])\s*\d{1,2}\s*日?/g

const ERA_BASE: Record<string, number> = { 昭和: 1925, S: 1925, 平成: 1988, H: 1988, 令和: 2018, R: 2018 }

/** 和暦・西暦の日付表記を YYYY-MM-DD にする（変換できなければ null） */
function toIsoDate(raw: string): string | null {
  const m = raw.replace(/\s/g, '').match(/^(昭和|平成|令和|[SHR]|)(\d{1,4})(?:年|[/.-])(\d{1,2})(?:月|[/.-])(\d{1,2})日?$/)
  if (!m) return null
  const year = m[1] ? (ERA_BASE[m[1]] ?? 0) + Number(m[2]) : Number(m[2])
  const mo = Number(m[3]), d = Number(m[4])
  if (year < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return `${year}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function maskPii(text: string, names: string[] = []): MaskResult {
  const tokens = new Map<string, string>()
  const counters: Record<string, number> = {}
  const found: Record<string, string[]> = {}

  const put = (kind: string, original: string): string => {
    for (const [tok, orig] of tokens) if (orig === original && tok.startsWith(`〔${kind}`)) return tok
    counters[kind] = (counters[kind] ?? 0) + 1
    const tok = `〔${kind}${counters[kind]}〕`
    tokens.set(tok, original)
    ;(found[kind] ??= []).push(original)
    return tok
  }

  let t = text

  // 登録済みの氏名・事業者名（長い順に置換して部分一致の取りこぼしを防ぐ）
  for (const n of [...new Set(names.map(x => x.trim()).filter(x => x.length >= 2))].sort((a, b) => b.length - a.length)) {
    t = t.split(n).join(put('氏名', n))
  }

  t = t.replace(/(口座(?:番号)?[：:\s]*)(\d{5,8})/g, (_m, pre: string, num: string) => pre + put('口座', num))
  t = t.replace(/(?<![\d-])\d{4}[-\s]?\d{4}[-\s]?\d{4}(?![\d-])/g, m => put('マイナンバー', m))
  t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, m => put('メール', m))
  t = t.replace(/(?<![\d-])0\d{1,4}-\d{1,4}-\d{3,4}(?![\d-])|(?<![\d-])0\d{9,10}(?![\d-])/g, m => put('電話', m))
  t = t.replace(/〒?\s?\d{3}-\d{4}/g, m => put('郵便番号', m))
  t = t.replace(DATE, (m, offset: number, whole: string) =>
    BIRTH_KEYWORD.test(whole.slice(Math.max(0, offset - 15), offset)) ? put('生年月日', m) : m)

  const direct: Direct[] = []
  const one = (kind: string) => (found[kind]?.length === 1 ? found[kind]![0]! : null)
  const mail = one('メール')
  if (mail) direct.push({ target: 'basic', key: 'contact_email', label: '担当者メール', value: mail })
  const birth = one('生年月日')
  const birthIso = birth ? toIsoDate(birth) : null
  if (birthIso) direct.push({ target: 'basic', key: 'representative_birthdate', label: '代表者生年月日', value: birthIso })
  const zip = one('郵便番号')
  if (zip) direct.push({ target: 'basic', key: 'postal_code', label: '郵便番号', value: zip.replace(/[〒\s]/g, '') })
  const phones = found['電話'] ?? []
  const mobiles = phones.filter(p => /^0[789]0/.test(p.replace(/-/g, '')))
  const fixed = phones.filter(p => !mobiles.includes(p))
  if (mobiles.length === 1) direct.push({ target: 'basic', key: 'contact_mobile', label: '担当者携帯', value: mobiles[0]! })
  if (fixed.length === 1) direct.push({ target: 'basic', key: 'company_phone', label: '会社電話番号', value: fixed[0]! })

  return { masked: t, tokens, direct }
}

/** 記号を元の文字に戻す。マイナンバー・口座は復元せず、記号のまま残す（保存させない） */
export function unmask(text: string, tokens: Map<string, string>): string {
  let out = text
  for (const [tok, orig] of tokens) {
    if (tok.startsWith('〔マイナンバー') || tok.startsWith('〔口座')) continue
    out = out.split(tok).join(orig)
  }
  return out
}
