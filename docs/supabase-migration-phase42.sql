-- ================================================================
-- Phase 42 マイグレーション — 役員月報の年間AI分析結果を年ごとに保存
-- 月報AI分析(monthly_report_ai_summaries)と同じ形で、1〜12月分の
-- 月報をまとめて分析した結果を年に1件保存し、あとから見返せるようにする。
-- 生成・上書きはAPIルート（service role）からのみ行う想定のため、
-- INSERT/UPDATEのRLSポリシーは設けない。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

CREATE TABLE public.annual_report_ai_summaries (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  year               INT         NOT NULL UNIQUE,
  overview           TEXT,
  highlights         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  risks              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  discussion_agenda  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  advice             JSONB       NOT NULL DEFAULT '[]'::jsonb,
  generated_by       UUID        REFERENCES public.profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.annual_report_ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annual_report_ai_summaries: executives read"
  ON public.annual_report_ai_summaries FOR SELECT
  USING (public.am_i_executive() OR public.get_my_role() = 'admin');
