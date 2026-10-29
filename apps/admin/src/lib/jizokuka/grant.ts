// 補助金交付申請額の計算（公募要領 第20回 第7版 6．補助率、補助上限額等 / 7．補助対象経費 に基づく）
//  - 補助金交付申請額の合計は補助上限額（通常50万円。特例を選ぶと上乗せ）を超えない
//  - 広報費・ウェブサイト関連費は、それぞれ補助金交付申請額の上限が30万円（税込）
//    （旧様式3の「ウェブサイト関連費は合計の1/4以内・最大50万円」は第20回では適用しない）
export const PR_GRANT_CAP = 300_000
export const WEB_GRANT_CAP = 300_000

export interface GrantResult {
  /** (b) 補助金交付申請額（ウェブサイト関連費を除く。広報費は30万円上限を反映） */
  grantNonWeb: number
  /** (d) ウェブサイト関連費の交付申請額 */
  grantWeb: number
  /** (f) 補助金交付申請額合計 */
  totalGrant: number
}

/**
 * @param nonWebTotal ウェブサイト関連費を除く補助対象経費（広報費を含む）
 * @param webTotal    ウェブサイト関連費
 * @param prTotal     nonWebTotal のうち広報費
 */
export function calcGrant(nonWebTotal: number, webTotal: number, rate: number, cap: number, prTotal = 0): GrantResult {
  // 広報費の申請額が30万円を超える分は、通常経費の合計から差し引く（合計額での切り捨ては維持）
  const prExcess = Math.max(0, Math.floor(prTotal * rate) - PR_GRANT_CAP)
  const grantNonWeb = Math.max(0, Math.min(Math.floor(nonWebTotal * rate) - prExcess, cap))
  // ウェブサイト関連費は、30万円と、合計の上限の残りまで
  const grantWeb = Math.max(0, Math.min(Math.floor(webTotal * rate), WEB_GRANT_CAP, cap - grantNonWeb))
  return { grantNonWeb, grantWeb, totalGrant: grantNonWeb + grantWeb }
}
