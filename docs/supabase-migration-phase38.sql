-- ================================================================
-- Phase 38 マイグレーション — 請求書・見積書発行機能
-- これまでGoogleスプレッドシートのひな形を都度コピーして作成していた
-- 請求書/見積書を、社内システムから作成・プレビュー・印刷/PDF化できるようにする。
-- 文書番号は種別(請求書=INV/見積書=EST)・発行日の年ごとに
-- INV-YYYY-0001 / EST-YYYY-0001 の形式で自動採番する。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

CREATE TABLE public.invoices (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no   TEXT        UNIQUE NOT NULL,
  doc_type     TEXT        NOT NULL DEFAULT 'invoice' CHECK (doc_type IN ('invoice', 'estimate')),
  customer_id  UUID        REFERENCES public.customers(id),
  billing_name TEXT        NOT NULL,
  issue_date   DATE        NOT NULL,
  due_date     DATE,
  items        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  tax_rate     NUMERIC     NOT NULL DEFAULT 10,
  notes        TEXT        NOT NULL DEFAULT '',
  created_by   UUID        REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices: authenticated read"
  ON public.invoices FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "invoices: authenticated insert"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoices: authenticated update"
  ON public.invoices FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoices: manager+ delete"
  ON public.invoices FOR DELETE
  USING (public.get_my_role() IN ('admin', 'manager'));

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.set_invoice_no()
RETURNS TRIGGER AS $$
DECLARE
  yr     TEXT;
  prefix TEXT;
  next_seq INT;
BEGIN
  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    yr := to_char(NEW.issue_date, 'YYYY');
    prefix := CASE WHEN NEW.doc_type = 'estimate' THEN 'EST' ELSE 'INV' END;
    SELECT COALESCE(MAX(substring(invoice_no FROM char_length(prefix) + 7)::int), 0) + 1
      INTO next_seq
      FROM public.invoices
      WHERE invoice_no LIKE prefix || '-' || yr || '-%';
    NEW.invoice_no := prefix || '-' || yr || '-' || lpad(next_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoices_set_invoice_no
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_no();
