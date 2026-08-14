-- ================================================================
-- Phase 28 マイグレーション — 社内ノウハウノート（手引き書）
-- 事務手引きなど「やり方がわかる」記事を、ロールを問わず全員が
-- 自由に読み書きできる社内Wikiとして新設する。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

CREATE TABLE public.knowhow_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  category    TEXT,
  body        TEXT        NOT NULL,
  created_by  UUID        REFERENCES public.profiles(id),
  updated_by  UUID        REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.knowhow_notes ENABLE ROW LEVEL SECURITY;

-- ログインしていれば誰でも閲覧・追加・編集・削除できる（オープンな社内Wiki）
CREATE POLICY "knowhow_notes: authenticated read"
  ON public.knowhow_notes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "knowhow_notes: authenticated insert"
  ON public.knowhow_notes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "knowhow_notes: authenticated update"
  ON public.knowhow_notes FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "knowhow_notes: authenticated delete"
  ON public.knowhow_notes FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_knowhow_notes_updated_at
  BEFORE UPDATE ON public.knowhow_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
