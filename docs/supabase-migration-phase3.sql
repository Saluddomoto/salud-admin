-- ================================================================
-- Phase 3 マイグレーション — スケジュール（events）・受信トレイ（messages）
-- 適用済みの supabase-schema.sql に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- ----------------------------------------------------------------
-- 1. ENUM 型
-- ----------------------------------------------------------------
CREATE TYPE event_category AS ENUM ('sales', 'meeting', 'deadline', 'internal');
CREATE TYPE message_channel AS ENUM ('line', 'email', 'web');
CREATE TYPE message_converted AS ENUM ('project', 'task', 'event');

-- ----------------------------------------------------------------
-- 2. events テーブル（スケジュール）
-- ----------------------------------------------------------------
CREATE TABLE public.events (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT           NOT NULL,
  event_date       DATE           NOT NULL,
  start_time       TIME           NOT NULL DEFAULT '09:00',
  end_time         TIME           NOT NULL DEFAULT '10:00',
  category         event_category NOT NULL DEFAULT 'meeting',
  customer_id      UUID           REFERENCES public.customers(id) ON DELETE SET NULL,
  project_id       UUID           REFERENCES public.projects(id)  ON DELETE SET NULL,
  assigned_user_id UUID           REFERENCES public.profiles(id),
  notes            TEXT,
  created_by       UUID           REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- スケジュールは全社共有のため、社員は全員分を閲覧できる
CREATE POLICY "events: staff+ read all"
  ON public.events FOR SELECT
  USING (public.get_my_role() IN ('admin', 'manager', 'staff'));

CREATE POLICY "events: staff+ insert"
  ON public.events FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'manager', 'staff'));

CREATE POLICY "events: manager+ update"
  ON public.events FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "events: staff update own"
  ON public.events FOR UPDATE
  USING (
    (assigned_user_id = auth.uid() OR created_by = auth.uid())
    AND public.get_my_role() = 'staff'
  );

CREATE POLICY "events: manager+ delete"
  ON public.events FOR DELETE
  USING (public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "events: staff delete own"
  ON public.events FOR DELETE
  USING (created_by = auth.uid() AND public.get_my_role() = 'staff');

-- ----------------------------------------------------------------
-- 3. messages テーブル（受信トレイ）
--    v3 で LINE / メール連携が入るまでは手動登録・デモ用
-- ----------------------------------------------------------------
CREATE TABLE public.messages (
  id           UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  channel      message_channel   NOT NULL,
  sender_name  TEXT              NOT NULL,
  company_name TEXT,
  customer_id  UUID              REFERENCES public.customers(id) ON DELETE SET NULL,
  body         TEXT              NOT NULL,
  received_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  is_read      BOOLEAN           NOT NULL DEFAULT FALSE,
  converted_to message_converted,
  created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages: staff+ read all"
  ON public.messages FOR SELECT
  USING (public.get_my_role() IN ('admin', 'manager', 'staff'));

CREATE POLICY "messages: staff+ insert"
  ON public.messages FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'manager', 'staff'));

CREATE POLICY "messages: staff+ update"
  ON public.messages FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'manager', 'staff'));

CREATE POLICY "messages: manager+ delete"
  ON public.messages FOR DELETE
  USING (public.get_my_role() IN ('admin', 'manager'));

-- ----------------------------------------------------------------
-- 4. updated_at トリガー・インデックス
-- ----------------------------------------------------------------
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_events_date        ON public.events   (event_date);
CREATE INDEX idx_events_assigned    ON public.events   (assigned_user_id);
CREATE INDEX idx_messages_received  ON public.messages (received_at DESC);
CREATE INDEX idx_messages_is_read   ON public.messages (is_read);

-- ================================================================
-- 5. デモ用シードデータ（任意 — 実行日基準で日付が入ります）
-- ================================================================
INSERT INTO public.events (title, event_date, start_time, end_time, category, assigned_user_id, created_by) VALUES
  ('朝礼・進捗確認',           CURRENT_DATE,     '09:00', '09:30', 'internal', (SELECT id FROM public.profiles LIMIT 1), (SELECT id FROM public.profiles LIMIT 1)),
  ('山田製作所 書類最終確認',  CURRENT_DATE,     '14:00', '15:30', 'meeting',  (SELECT id FROM public.profiles LIMIT 1), (SELECT id FROM public.profiles LIMIT 1)),
  ('IT補助金 電話相談（鈴木商店）', CURRENT_DATE, '16:30', '17:00', 'sales',   (SELECT id FROM public.profiles LIMIT 1), (SELECT id FROM public.profiles LIMIT 1)),
  ('新規顧客ヒアリング',       CURRENT_DATE + 1, '10:00', '11:00', 'sales',    (SELECT id FROM public.profiles LIMIT 1), (SELECT id FROM public.profiles LIMIT 1)),
  ('ものづくり補助金 申請締切', CURRENT_DATE + 2, '17:00', '17:00', 'deadline', (SELECT id FROM public.profiles LIMIT 1), (SELECT id FROM public.profiles LIMIT 1)),
  ('テックス 打ち合わせ',      CURRENT_DATE + 3, '14:00', '15:00', 'sales',    (SELECT id FROM public.profiles LIMIT 1), (SELECT id FROM public.profiles LIMIT 1)),
  ('週次ミーティング',         CURRENT_DATE + 7, '09:30', '10:30', 'internal', (SELECT id FROM public.profiles LIMIT 1), (SELECT id FROM public.profiles LIMIT 1));

INSERT INTO public.messages (channel, sender_name, company_name, body, received_at, is_read, converted_to) VALUES
  ('line',  '山田 太郎', '山田製作所',       '書類の件、確認しました。明日までに残りをお送りします。',               NOW() - INTERVAL '1 hour',  FALSE, NULL),
  ('email', '鈴木 花子', '鈴木商店',         '見積書を添付いたします。ご確認のほどよろしくお願いいたします。',       NOW() - INTERVAL '2 hours', FALSE, NULL),
  ('web',   '斎藤 隆',   '（新規問い合わせ）', 'ものづくり補助金の申請サポートについて相談したいのですが…',           NOW() - INTERVAL '3 hours', FALSE, NULL),
  ('line',  '高橋 健一', 'テックス',         '来週の打ち合わせ、水曜14時でお願いできますか？',                       NOW() - INTERVAL '1 day',   TRUE,  'event'),
  ('email', '伊藤 美咲', 'ABC',              '交付決定通知書が届きました。今後の手続きについて教えてください。',     NOW() - INTERVAL '1 day',   TRUE,  'task'),
  ('web',   '中村 大輔', '北陸物流',         '省力化投資補助金の対象になるか確認をお願いしたく…',                   NOW() - INTERVAL '3 days',  TRUE,  'project');
