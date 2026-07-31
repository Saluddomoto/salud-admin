-- ================================================================
-- Phase 12 マイグレーション — 役員月報（相互閲覧可能な月次活動報告）
-- 適用済みの supabase-schema.sql + phase3〜11 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- 役員フラグ（システムロールとは別軸。設定＞メンバー管理で admin が付与）
ALTER TABLE public.profiles
  ADD COLUMN is_executive BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.am_i_executive()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_executive, FALSE) FROM public.profiles WHERE id = auth.uid();
$$;

-- 役員同士は互いのプロフィール（氏名）を読める（月報の一覧表示に必要）
CREATE POLICY "profiles: executives read executives"
  ON public.profiles FOR SELECT
  USING (is_executive = TRUE AND public.am_i_executive());

CREATE TABLE public.monthly_reports (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period            DATE        NOT NULL, -- 対象月の1日（例: 2026-07-01）
  actions           TEXT,       -- 行動
  sales             TEXT,       -- 営業
  tasks             TEXT,       -- タスク
  work_performance  TEXT,       -- 稼働実績
  initiatives       TEXT,       -- 取り組んだこと
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period)
);

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

-- 役員は互いの月報を相互閲覧可能、管理者も閲覧可能（将来の評価用途を想定）
CREATE POLICY "monthly_reports: executives read all"
  ON public.monthly_reports FOR SELECT
  USING (public.am_i_executive() OR public.get_my_role() = 'admin');

CREATE POLICY "monthly_reports: author insert"
  ON public.monthly_reports FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.am_i_executive());

CREATE POLICY "monthly_reports: author or admin update"
  ON public.monthly_reports FOR UPDATE
  USING ((user_id = auth.uid() AND public.am_i_executive()) OR public.get_my_role() = 'admin');

CREATE POLICY "monthly_reports: author or admin delete"
  ON public.monthly_reports FOR DELETE
  USING ((user_id = auth.uid() AND public.am_i_executive()) OR public.get_my_role() = 'admin');
