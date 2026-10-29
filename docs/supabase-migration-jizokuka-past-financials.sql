-- 持続化パイロット: 決算実績（前々期・前期・直近期）を案件ごとに保存する
-- [{"period":"直近期","revenue":78000000,"gross_profit":19500000,"ordinary_profit":1900000}, ...]
alter table jizokuka.case_hearings
  add column if not exists past_financials jsonb not null default '[]'::jsonb;
