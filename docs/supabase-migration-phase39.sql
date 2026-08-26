-- ================================================================
-- Phase 39 マイグレーション — 請求書・見積書の備考欄テンプレート
-- 振込先や契約条件など、備考欄によく使う文面を複数保存しておき、
-- 作成画面から選んで差し込めるようにする。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

CREATE TABLE public.invoice_note_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  label      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  created_by UUID        REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.invoice_note_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_note_templates: authenticated read"
  ON public.invoice_note_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "invoice_note_templates: authenticated insert"
  ON public.invoice_note_templates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoice_note_templates: authenticated update"
  ON public.invoice_note_templates FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoice_note_templates: authenticated delete"
  ON public.invoice_note_templates FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_invoice_note_templates_updated_at
  BEFORE UPDATE ON public.invoice_note_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
