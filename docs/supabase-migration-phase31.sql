-- Phase 31: 契約書(contracts)を作成後に編集できるようにする
-- 差し込み項目を後から埋める運用のため、UPDATE用RLSポリシーが存在しなかった問題を解消。
-- 範囲はINSERTと同じ「認証済みなら誰でも」。

create policy "contracts: authenticated update" on contracts
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
