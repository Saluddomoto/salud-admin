-- ================================================================
-- Phase 23 マイグレーション — 役員会議 事前シート（相互閲覧可能な役員向けドキュメント）
-- 適用済みの supabase-schema.sql + phase3〜22 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

CREATE TABLE public.board_prep_sheets (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  ideal_future            TEXT,       -- ① 2年後のSaludの理想像
  why_involved            TEXT,       -- ② なぜSaludと関わるのか
  this_year_contribution  TEXT,       -- ③ 今年、自分がSaludにもたらしたいこと
  year_end_reflection     TEXT,       -- 最後に（年末の理想状態）
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.board_prep_sheets ENABLE ROW LEVEL SECURITY;

-- 役員は互いのシートを相互閲覧可能、管理者も閲覧可能
CREATE POLICY "board_prep_sheets: executives read all"
  ON public.board_prep_sheets FOR SELECT
  USING (public.am_i_executive() OR public.get_my_role() = 'admin');

CREATE POLICY "board_prep_sheets: author insert"
  ON public.board_prep_sheets FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.am_i_executive());

CREATE POLICY "board_prep_sheets: author or admin update"
  ON public.board_prep_sheets FOR UPDATE
  USING ((user_id = auth.uid() AND public.am_i_executive()) OR public.get_my_role() = 'admin');

CREATE TRIGGER trg_board_prep_sheets_updated_at
  BEFORE UPDATE ON public.board_prep_sheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
