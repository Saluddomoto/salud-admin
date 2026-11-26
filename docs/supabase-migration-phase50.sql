-- ================================================================
-- Phase 50 マイグレーション — 実績報告サポート報酬の入金予定日・入金日
-- WEB制作と同じ考え方: 入金日があれば確定、なければ見込みで売上に計上する
-- ================================================================
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS support_fee_due_date DATE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS support_fee_received_date DATE;
