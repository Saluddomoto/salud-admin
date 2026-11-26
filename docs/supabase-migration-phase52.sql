-- ================================================================
-- Phase 52 マイグレーション — ゼスタス請求リストの金額を項目ごとに自由に調整
-- NULL = 案件の基本料金・成功報酬から自動計算した金額をそのまま使う
-- ================================================================
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS zestas_base_amount BIGINT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS zestas_success_amount BIGINT;
