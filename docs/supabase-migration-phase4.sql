-- ================================================================
-- Phase 4 マイグレーション — LINE 連携・要返信フラグ
-- supabase-migration-phase3.sql 適用後に、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- 要返信フラグ（受信トレイで「返信が必要」を管理）
ALTER TABLE public.messages ADD COLUMN needs_reply BOOLEAN NOT NULL DEFAULT FALSE;

-- LINE 連携: 送信者の LINE ユーザーID（返信・顧客マッチング用）
ALTER TABLE public.messages  ADD COLUMN line_user_id TEXT;
ALTER TABLE public.customers ADD COLUMN line_user_id TEXT;

CREATE INDEX idx_messages_needs_reply ON public.messages  (needs_reply) WHERE needs_reply;
CREATE INDEX idx_customers_line_user  ON public.customers (line_user_id);

-- 既存の未読・未変換メッセージを要返信扱いにする（デモデータ用・任意）
UPDATE public.messages SET needs_reply = TRUE
WHERE is_read = FALSE AND converted_to IS NULL;
