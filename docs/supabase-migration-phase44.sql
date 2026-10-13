-- ================================================================
-- Phase 44 マイグレーション — 受信トレイに「どの公式LINEか」を記録
-- supabase-migration-phase43.sql 適用後に、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- 2つ目の公式LINE（補助金の窓口）を同じ Webhook で受けるため、
-- メッセージの届き先アカウントを記録する。
-- NULL = 従来の公式LINE（既存のメッセージはすべて NULL のまま）、'hojokin' = 補助金の窓口
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS line_account TEXT;
