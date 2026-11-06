-- ================================================================
-- Phase 47 マイグレーション — 請求書・見積書の発行会社(Salud / ゼスタス)選択
-- ================================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS issuer TEXT NOT NULL DEFAULT 'salud'
  CHECK (issuer IN ('salud','zestas'));

-- 冒頭の挨拶文(定型文)を書類ごとに編集可能に。NULL = 標準の文面
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS greeting TEXT;
