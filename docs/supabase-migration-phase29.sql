-- ================================================================
-- Phase 29 マイグレーション — 契約書作成（テンプレート差し込み）
-- クライアント・代理店に提示する契約書を、社内テンプレートに
-- 相手先名・住所・代表者名・契約日を差し込んで作成する機能。
-- 生成結果はスナップショットとして保存（後から内容を編集する用途ではなく、
-- 間違えたら作り直す運用）。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

CREATE TABLE public.contracts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key       TEXT        NOT NULL,
  partner_name       TEXT        NOT NULL,
  partner_address    TEXT        NOT NULL,
  representative_name TEXT       NOT NULL,
  contract_date      DATE        NOT NULL,
  body               TEXT        NOT NULL,
  created_by         UUID        REFERENCES public.profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts: authenticated read"
  ON public.contracts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "contracts: authenticated insert"
  ON public.contracts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "contracts: manager+ delete"
  ON public.contracts FOR DELETE
  USING (public.get_my_role() IN ('admin', 'manager'));
