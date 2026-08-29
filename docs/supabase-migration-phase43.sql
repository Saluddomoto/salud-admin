-- ================================================================
-- Phase 43 マイグレーション — 外部リード(hojokin-app等)の手動取り込み用フィールド
-- hojokin-app(補助金の窓口)側は先方管理のため開発不可。Webhook/API連携が
-- 整うまでの「つなぎ」として、hojokin-appの管理画面で確認したリード情報を
-- customersに手動入力できるよう、リード固有の項目を追加する。
-- ================================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS external_lead_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS lead_source TEXT,
  ADD COLUMN IF NOT EXISTS selected_subsidy_name TEXT,
  ADD COLUMN IF NOT EXISTS matching_score INT,
  ADD COLUMN IF NOT EXISTS matching_reason TEXT,
  ADD COLUMN IF NOT EXISTS via_agency BOOLEAN,
  ADD COLUMN IF NOT EXISTS lead_registered_at TIMESTAMPTZ;

COMMENT ON COLUMN public.customers.external_lead_id IS '外部リード連携元(例: hojokin-app)でのリードID。手動取り込み時の重複防止キー';
COMMENT ON COLUMN public.customers.lead_source IS 'リードの取得元(例: hojokin_app)。手動追加した通常顧客はNULL';
