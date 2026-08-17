-- ================================================================
-- Phase 36b マイグレーション — Chatwork連携（列追加）
-- phase36.sql（ALTER TYPE）を先に実行してから、こちらを実行してください
-- ================================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS chatwork_room_id    TEXT,
  ADD COLUMN IF NOT EXISTS chatwork_account_id TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS chatwork_account_id TEXT;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS chatwork_room_id TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_chatwork_room_id  ON public.messages  (chatwork_room_id);
CREATE INDEX IF NOT EXISTS idx_customers_chatwork_room_id ON public.customers (chatwork_room_id);
