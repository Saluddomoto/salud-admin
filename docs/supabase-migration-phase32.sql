-- ================================================================
-- Phase 32 マイグレーション — 契約書(contracts)の差し込み値を汎用化
-- これまでpartner_name/partner_address/representative_name/contract_date の
-- 固定4カラムだったが、テンプレートごとに項目数・内容が異なるため
-- values(JSONB, {token: value}) に一般化する。
-- 既存データはvaluesへ変換のうえ、旧カラムはNULL許可にして残す（互換のため）。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS values JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.contracts ALTER COLUMN partner_name DROP NOT NULL;
ALTER TABLE public.contracts ALTER COLUMN partner_address DROP NOT NULL;
ALTER TABLE public.contracts ALTER COLUMN representative_name DROP NOT NULL;
ALTER TABLE public.contracts ALTER COLUMN contract_date DROP NOT NULL;

UPDATE public.contracts SET values = jsonb_build_object(
  '【相手先会社名】', partner_name,
  '【相手先住所】', partner_address,
  '【代表者名】', representative_name,
  '【契約日】', contract_date::text
) WHERE template_key = 'partner_agreement' AND values = '{}'::jsonb;
