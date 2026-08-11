-- ================================================================
-- Phase 21 マイグレーション
-- 適用済みの supabase-schema.sql + phase3〜20 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- 会社全体の年間KGI（Excel「入力_前提」シートの全体KGI相当）。年ごとに1行。
CREATE TABLE public.revenue_settings (
  year                            INT PRIMARY KEY,
  annual_target_amount            NUMERIC NOT NULL,
  target_gross_margin_rate        NUMERIC NOT NULL,
  executive_compensation_monthly  NUMERIC,
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                      UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.revenue_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revenue_settings: admin only"
  ON public.revenue_settings FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- 商品カテゴリ別の年間目標（Excel「入力_前提」シートの商品別前提相当）。
-- 未設定のカテゴリ・年は src/lib/revenueCategories.ts のデフォルト値を使う
-- （このテーブルは上書き分のみ保存、年×カテゴリで一意）。
CREATE TABLE public.revenue_category_targets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year            INT NOT NULL,
  category        TEXT NOT NULL,
  target_count    NUMERIC NOT NULL,
  unit_price      NUMERIC NOT NULL,
  cost_rate       NUMERIC NOT NULL,
  acceptance_rate NUMERIC,
  is_monthly      BOOLEAN NOT NULL DEFAULT false,
  memo            TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, category)
);

ALTER TABLE public.revenue_category_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revenue_category_targets: admin only"
  ON public.revenue_category_targets FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');
