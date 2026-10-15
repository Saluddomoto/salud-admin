-- ================================================================
-- Phase 46 マイグレーション — コラムのテーマ候補リスト(事前確認用)
-- supabase-migration-phase45.sql 適用後に実行
-- ================================================================
-- 毎晩の自動下書きは、status='pending' のうち seq が最小のものを書く。
-- 無くなったら、従来どおりAIが切り口を選ぶ。
CREATE TABLE IF NOT EXISTS public.column_topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq         INTEGER NOT NULL UNIQUE,
  subsidy     TEXT NOT NULL,                       -- 'jizokuka' | 'shinmono' | 'shoryokuka'
  topic       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','skip')),
  wp_post_id  INTEGER,
  done_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.column_topics ENABLE ROW LEVEL SECURITY;

INSERT INTO public.column_topics (seq, subsidy, topic) VALUES
  (1, 'shoryokuka', '省力化投資補助金(一般型)とは?第8回の対象者・補助額・補助率を表で解説'),
  (2, 'shoryokuka', '従業員数別の補助上限額(750万〜8,000万円)と特例を使った場合の上限'),
  (3, 'shoryokuka', '賃上げ要件(給与支給総額の年平均成長率3.5%・事業所内最低賃金+30円)の考え方'),
  (4, 'jizokuka', '電子申請に必要なGビズIDプライムはいつまでに取る?取得手順と注意点'),
  (5, 'shoryokuka', '大幅賃上げ特例とは?補助上限額が250万〜2,000万円上乗せになる条件'),
  (6, 'jizokuka', '採択されやすい経営計画書の書き方(見出しごとのポイント)'),
  (7, 'shinmono', '補助額・補助率の早見表(従業員規模別)'),
  (8, 'shoryokuka', '最低賃金引き上げ特例とは?補助率が1/2から2/3になる条件'),
  (9, 'jizokuka', '特例枠(賃金引上げ枠・卒業枠・後継者支援枠など)の違いと選び方'),
  (10, 'shinmono', '新事業進出の「3つの要件」とは(新規性・市場性・付加価値額など)'),
  (11, 'shoryokuka', '賃上げ要件を達成できないと補助金は返還?(再生事業者の免除も)'),
  (12, 'jizokuka', 'インボイス特例の上乗せ条件'),
  (13, 'shinmono', '賃上げ要件と付加価値額要件の考え方'),
  (14, 'shoryokuka', '対象経費の一覧と注意点(機械装置・システム構築費が必須)'),
  (15, 'jizokuka', '補助対象外になりやすい経費(車両・汎用品・消耗品など)'),
  (16, 'shinmono', '事業計画書の作り方と審査で見られる点'),
  (17, 'shoryokuka', '補助対象外の経費・事業(建物・汎用品・ウイルス対策ソフトなど)'),
  (18, 'jizokuka', '見積書・相見積もりのルール(50万円以上の場合など)'),
  (19, 'shinmono', '建物費・機械装置費など対象経費の注意点'),
  (20, 'shoryokuka', '専門家経費・外注費・技術導入費は併用できない?支出の組み合わせルール'),
  (21, 'jizokuka', '採択後の流れ(交付申請→実績報告→入金)と入金時期'),
  (22, 'shinmono', '採択後の流れ(交付申請→事業実施→実績報告→入金)'),
  (23, 'shoryokuka', '事業実施期間(交付決定から17か月)と発注・支払いのタイミング'),
  (24, 'jizokuka', '実績報告で差し戻されやすいポイント'),
  (25, 'shinmono', '認定経営革新等支援機関(認定支援機関)の関わり方と確認書の扱い'),
  (26, 'shoryokuka', '補助対象外になる事業者(過去の交付決定歴・みなし同一法人など)'),
  (27, 'jizokuka', 'チラシ・広告費、ウェブサイト関連費の上限(ウェブサイト関連費のルール)'),
  (28, 'shinmono', '加点項目の一覧と取り方(パートナーシップ構築宣言など)'),
  (29, 'shoryokuka', '財産処分の制限(補助金で買った設備の売却・転用で返納になる場合)'),
  (30, 'jizokuka', '申請できない事業者(対象外業種・要件)のチェックリスト'),
  (31, 'shinmono', '事業化状況報告とフォローアップ(5年間の義務)'),
  (32, 'jizokuka', '商工会地区と商工会議所地区の違いと、自社がどちらかの調べ方'),
  (33, 'shinmono', '財産処分のルール(補助金で買った設備の売却・転用)'),
  (34, 'jizokuka', '採択後に計画を変更したいとき(経費の配分変更・軽微な変更)'),
  (35, 'shinmono', '申請前に準備するもの(決算書・賃金台帳など)のチェックリスト'),
  (36, 'shinmono', '旧「ものづくり補助金」「事業再構築補助金」との違い')
ON CONFLICT (seq) DO NOTHING;
