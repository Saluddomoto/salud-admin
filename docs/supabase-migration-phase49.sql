-- ================================================================
-- Phase 49 マイグレーション — 実績報告サポートの報酬(自由入力)
-- 基本料金・成功報酬とは別に、報酬額(円)と内容メモを案件に持たせる
-- ================================================================
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS support_fee BIGINT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS support_fee_note TEXT;
