-- ================================================================
-- Phase 41 マイグレーション — 役員月報AI分析の結果を月ごとに保存
-- クリックして生成したAI分析（要約・好調な点・共通の課題・
-- 月末会議のアジェンダ・アドバイス）を月報の月（period）に1件だけ
-- 保存し、あとからその月を開いたときに再生成せず見返せるようにする。
-- 生成・上書きはAPIルート（service role）からのみ行う想定のため、
-- INSERT/UPDATEのRLSポリシーは設けない（クライアントからの直接書き込みは想定しない）。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

CREATE TABLE public.monthly_report_ai_summaries (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  period             DATE        NOT NULL UNIQUE, -- 対象月の1日（例: 2026-08-01）
  overview           TEXT,
  highlights         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  risks              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  discussion_agenda  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  advice             JSONB       NOT NULL DEFAULT '[]'::jsonb,
  generated_by       UUID        REFERENCES public.profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.monthly_report_ai_summaries ENABLE ROW LEVEL SECURITY;

-- 役員月報と同じ対象範囲（役員 or admin）のみ読める
CREATE POLICY "monthly_report_ai_summaries: executives read"
  ON public.monthly_report_ai_summaries FOR SELECT
  USING (public.am_i_executive() OR public.get_my_role() = 'admin');
