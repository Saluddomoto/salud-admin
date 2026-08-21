// jGrants（デジタル庁 補助金ポータル）公開APIから受付中の補助金を取得する。
// 認証不要の公開エンドポイント。keyword が必須のため、経産省系の主要補助金を
// キーワード巡回して id で重複排除する。
// APIドキュメント: https://developers.digital.go.jp/documents/jgrants/api/

const JGRANTS_ENDPOINT = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies'

// 経産省・中小企業庁系の主要補助金（受付中のものを拾う）
const KEYWORDS = [
  'ものづくり補助金',
  '新事業進出補助金',
  '省力化投資補助金',
  '中小企業省力化投資補助金',
  'IT導入補助金',
  '事業承継・M&A補助金',
  '成長加速化補助金',
  '小規模事業者持続化補助金',
  '大規模成長投資補助金',
  '中小企業生産性革命推進事業',
]

type JgrantsListItem = {
  id: string
  name?: string
  title?: string
  institution_name?: string
  subsidy_max_limit?: number | null
  target_area_search?: string | null
  target_number_of_employees?: string | null
  acceptance_start_datetime?: string | null
  acceptance_end_datetime?: string | null
}

export type SubsidyProgramRow = {
  jgrants_id: string
  name: string
  institution_name: string | null
  max_amount: number | null
  target_area: string | null
  target_employees: string | null
  acceptance_start: string | null
  acceptance_end: string | null
  detail_url: string
  source: 'jgrants'
}

async function fetchByKeyword(keyword: string): Promise<JgrantsListItem[]> {
  const params = new URLSearchParams({
    keyword,
    sort: 'acceptance_end_datetime',
    order: 'ASC',
    acceptance: '1', // 受付中のみ
  })
  const res = await fetch(`${JGRANTS_ENDPOINT}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    // 政府APIのキャッシュを避け毎回最新を取る
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`jGrants API ${res.status} for keyword=${keyword}`)
  const json = (await res.json()) as { result?: JgrantsListItem[] }
  return json.result ?? []
}

// 全キーワードを巡回し、id で重複排除した受付中補助金の一覧を返す
export async function fetchJgrantsSubsidies(): Promise<SubsidyProgramRow[]> {
  const byId = new Map<string, JgrantsListItem>()
  for (const kw of KEYWORDS) {
    try {
      const items = await fetchByKeyword(kw)
      for (const it of items) {
        if (it?.id) byId.set(it.id, it)
      }
    } catch (e) {
      // 1キーワードが失敗しても全体は続行
      console.error('jgrants: keyword fetch failed', kw, e)
    }
  }

  return [...byId.values()].map(it => ({
    jgrants_id:       it.id,
    name:             (it.title || it.name || '（名称不明）').trim(),
    institution_name: it.institution_name ?? null,
    max_amount:       typeof it.subsidy_max_limit === 'number' ? it.subsidy_max_limit : null,
    target_area:      it.target_area_search ?? null,
    target_employees: it.target_number_of_employees ?? null,
    acceptance_start: it.acceptance_start_datetime ?? null,
    acceptance_end:   it.acceptance_end_datetime ?? null,
    detail_url:       `https://www.jgrants-portal.go.jp/subsidy/${it.id}`,
    source:           'jgrants',
  }))
}
