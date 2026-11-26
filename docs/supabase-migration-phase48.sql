-- ================================================================
-- Phase 48 マイグレーション — 案件の「支援項目」(例: 実績報告サポート)
-- ================================================================
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS support_items TEXT[] NOT NULL DEFAULT '{}';
