// 補助金交付申請額の計算（公募要領 第20回 第7版 6．補助率、補助上限額等 / 7．補助対象経費 と 様式3 の経費明細表に基づく）
//  - 補助金交付申請額の合計(f)は補助上限額（通常50万円。特例を選ぶと上乗せ）を超えない
//  - 広報費・ウェブサイト関連費は、それぞれ補助金交付申請額の上限が30万円（税込）
//    （旧様式3の「ウェブサイト関連費は合計の1/4以内・最大50万円」は第20回では適用しない）
//  - 上限に達する場合、(b)ウェブ以外と(d)ウェブは、合計が上限になる範囲で配分を選べる（様式3の判定式と同じ）。
//    ここでは、ウェブサイト関連費の申請額が最大になる側で表示する
export const PR_GRANT_CAP = 300_000
export const WEB_GRANT_CAP = 300_000

export interface GrantResult {
  /** (b) 補助金交付申請額（ウェブサイト関連費を除く。広報費は30万円上限を反映） */
  grantNonWeb: number
  /** (d) ウェブサイト関連費の交付申請額 */
  grantWeb: number
  /** (f) 補助金交付申請額合計 */
  totalGrant: number
  /** 配分を選べる範囲: (b) は nonWebMin〜nonWebMax、(d) は webMin〜webMax（両端が同じなら選択の余地なし） */
  nonWebMin: number
  nonWebMax: number
  webMin: number
  webMax: number
}

/**
 * @param nonWebTotal ウェブサイト関連費を除く補助対象経費（広報費を含む）
 * @param webTotal    ウェブサイト関連費
 * @param prTotal     nonWebTotal のうち広報費
 */
export function calcGrant(nonWebTotal: number, webTotal: number, rate: number, cap: number, prTotal = 0): GrantResult {
  // 広報費の申請額が30万円を超える分は、通常経費の合計から差し引く（合計額での切り捨ては維持）
  const prExcess = Math.max(0, Math.floor(prTotal * rate) - PR_GRANT_CAP)
  const rawNonWeb = Math.max(0, Math.floor(nonWebTotal * rate) - prExcess)
  const rawWeb = Math.min(Math.floor(webTotal * rate), WEB_GRANT_CAP)
  const totalGrant = Math.min(rawNonWeb + rawWeb, cap)
  // ウェブ側を最大にした配分 / ウェブ以外を最大にした配分
  const webMax = Math.min(rawWeb, totalGrant)
  const nonWebMax = Math.min(rawNonWeb, totalGrant)
  return {
    grantNonWeb: totalGrant - webMax,
    grantWeb: webMax,
    totalGrant,
    nonWebMin: totalGrant - webMax,
    nonWebMax,
    webMin: totalGrant - nonWebMax,
    webMax,
  }
}

/** 基本情報の特例の選択から、補助上限額と補助率を決める（公募要領 第20回 6．補助率、補助上限額等）
 *  通常50万円／インボイス特例+50万円／賃金引上げ特例+150万円／両方で+200万円（=250万円）。
 *  賃金引上げ特例のうち赤字事業者は補助率3/4 */
export function specialRule(invoice: string | null | undefined, wage: string | null | undefined): { cap: number; rate: number; label: string } {
  const inv = !!invoice && invoice.startsWith('希望する')
  const wg = !!wage && wage.startsWith('希望する')
  const cap = 500_000 + (inv ? 500_000 : 0) + (wg ? 1_500_000 : 0)
  const red = wg && !!wage && wage.includes('赤字')
  const label = [inv && 'インボイス特例', wg && (red ? '賃金引上げ特例（赤字事業者）' : '賃金引上げ特例')].filter(Boolean).join('＋') || '通常枠'
  return { cap, rate: red ? 0.75 : 0.6667, label }
}
