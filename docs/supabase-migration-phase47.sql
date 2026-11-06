-- ================================================================
-- Phase 47 マイグレーション — 請求書・見積書の発行会社(Salud / ゼスタス)選択
-- ================================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS issuer TEXT NOT NULL DEFAULT 'salud'
  CHECK (issuer IN ('salud','zestas'));

-- 冒頭の挨拶文(定型文)を書類ごとに編集可能に。NULL = 標準の文面
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS greeting TEXT;

-- 書類番号は発行会社ごとに採番。Salud: INV/EST-YYYY-NNNN、ゼスタス: ZINV/ZEST-YYYY-NNNN
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
    IF NEW.issuer = 'zestas' THEN prefix := 'Z' || prefix; END IF;
    SELECT COALESCE(MAX(substring(invoice_no FROM char_length(prefix) + 7)::int), 0) + 1
      INTO next_seq
      FROM public.invoices
      WHERE invoice_no LIKE prefix || '-' || yr || '-%';
    NEW.invoice_no := prefix || '-' || yr || '-' || lpad(next_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
