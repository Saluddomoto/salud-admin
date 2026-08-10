-- ================================================================
-- Phase 19 マイグレーション
-- 適用済みの supabase-schema.sql + phase3〜18 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- 売上台帳: 案件化されない売上（保守・SEO支援など）を直接記録する台帳。
-- 補助金・WEB制作の案件由来の売上は projects テーブルから都度計算して
-- 台帳に重ねて表示する(二重入力しない・triggerでの同期はしない)ため、
-- ここに保存するのは手入力分のみ。
CREATE TABLE public.revenue_ledger (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date            DATE NOT NULL,
  payer_name            TEXT NOT NULL,
  category              TEXT NOT NULL,
  amount_excl_tax       NUMERIC NOT NULL,
  status                TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'forecast')),
  payment_due_date      DATE,
  payment_received_date DATE,
  memo                  TEXT,
  created_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.revenue_ledger (entry_date);

ALTER TABLE public.revenue_ledger ENABLE ROW LEVEL SECURITY;

-- 売上管理は堂本さん(admin)のみ閲覧・編集可能
CREATE POLICY "revenue_ledger: admin only"
  ON public.revenue_ledger FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');
