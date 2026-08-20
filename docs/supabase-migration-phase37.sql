-- ================================================================
-- Phase 37 マイグレーション — ルーティンタスク（日々のタスク）＋ ダッシュボードZoom URL
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- 1. ルーティンタスク（期限を設定せず、毎日「今日のタスク」に出したいタスク）
--    完了状態はタスク自身の status ではなく、日付ごとの完了ログ(task_completions)で管理する。
--    （task.status を使うと「一度完了にしたら翌日も完了扱いのまま」になってしまうため）
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_routine BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.task_completions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  completed_on DATE NOT NULL,
  completed_by UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, completed_on)
);

ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_completions: manager+ all"
  ON public.task_completions FOR ALL
  USING (public.get_my_role() IN ('admin', 'manager'))
  WITH CHECK (public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "task_completions: staff read own task"
  ON public.task_completions FOR SELECT
  USING (
    public.get_my_role() = 'staff'
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND (t.assigned_user_id = auth.uid() OR t.created_by = auth.uid())
    )
  );

CREATE POLICY "task_completions: staff insert own task"
  ON public.task_completions FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'staff'
    AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assigned_user_id = auth.uid())
  );

CREATE POLICY "task_completions: staff delete own"
  ON public.task_completions FOR DELETE
  USING (public.get_my_role() = 'staff' AND completed_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_task_completions_task ON public.task_completions (task_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_date ON public.task_completions (completed_on);

-- 2. ダッシュボードのZoom URL（全社共有・1件のみ）
CREATE TABLE IF NOT EXISTS public.dashboard_settings (
  id         INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  zoom_url   TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id)
);

INSERT INTO public.dashboard_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.dashboard_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_settings: staff+ read"
  ON public.dashboard_settings FOR SELECT
  USING (public.get_my_role() IN ('admin', 'manager', 'staff'));

CREATE POLICY "dashboard_settings: staff+ update"
  ON public.dashboard_settings FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'manager', 'staff'))
  WITH CHECK (public.get_my_role() IN ('admin', 'manager', 'staff'));

-- 3. 売上台帳（手入力）の明細が「基本料金」か「成功報酬」かを選べるようにする。
--    案件由来の行（採択済み・申請中の補助金案件）は base_fee/success_fee_rate から
--    自動で内訳を出しているため対象外（アプリ側のロジックのみで対応、DB変更不要）。
ALTER TABLE public.revenue_ledger
  ADD COLUMN IF NOT EXISTS fee_type TEXT CHECK (fee_type IN ('base_fee', 'success_fee'));
