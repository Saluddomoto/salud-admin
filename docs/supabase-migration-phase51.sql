-- ================================================================
-- Phase 51 マイグレーション — ゼスタス請求リストの「入金済」チェック
-- 基本料金・成功報酬それぞれ、ゼスタスから入金された日を記録する
-- ================================================================
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS zestas_base_paid_date DATE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS zestas_success_paid_date DATE;
