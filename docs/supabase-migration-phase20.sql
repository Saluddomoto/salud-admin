-- ================================================================
-- Phase 20 マイグレーション
-- 適用済みの supabase-schema.sql + phase3〜19 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- 月額契約(保守・SEO支援など毎月同額発生するもの)。
-- last_generated_month で「売上台帳に反映済みの最終月」を追跡し、
-- 売上管理ページを開くたびに未反映の月だけ自動で revenue_ledger に追加する
-- (二重登録防止・triggerではなくアプリ側のオンデマンド同期)。
CREATE TABLE public.recurring_contracts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_name              TEXT NOT NULL,
  category                TEXT NOT NULL,
  monthly_amount_excl_tax NUMERIC NOT NULL,
  start_month             DATE NOT NULL,
  end_month               DATE,
  last_generated_month    DATE,
  memo                    TEXT,
  created_by              UUID REFERENCES public.profiles(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_contracts: admin only"
  ON public.recurring_contracts FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');
