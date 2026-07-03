# 基幹システム インフラ構成設計書

> 株式会社Salud — admin.salud.co.jp  
> 作成日: 2026-06-28 / 更新日: 2026-06-28  
> **初期フェーズ: 月額0円構成**

---

## 1. 技術スタック

| レイヤー | 採用技術 | 無料枠 | 有料移行 |
|---------|---------|--------|---------|
| フロントエンド | Next.js 14 (App Router, TypeScript) | — | — |
| スタイリング | Tailwind CSS | — | — |
| 認証 | Supabase Auth | Free（50,000 MAU） | Pro $25/月 |
| データベース | Supabase PostgreSQL | Free（500MB / 2プロジェクト） | Pro $25/月 |
| ファイル | Supabase Storage | Free（1GB） | Pro $25/月 |
| ホスティング | Vercel Hobby | 無料（カスタムドメイン対応） | Pro $20/月 |
| リポジトリ | GitHub Free | 無料（プライベートリポジトリ） | — |

> **Xserver**：コーポレートサイト（salud.co.jp）のみ利用。基幹システムは別系統。

---

## 2. インフラ構成図

```
              ┌──────────────────┐     ┌──────────────────┐
              │   社員ブラウザ    │     │ 顧客ブラウザ（将来）│
              └────────┬─────────┘     └────────┬─────────┘
                       │ HTTPS                   │ HTTPS
              ┌─────────▼─────────────────────────▼────────┐
              │          Vercel Hobby（無料）                 │
              │        admin.salud.co.jp                    │
              │    SSL: Let's Encrypt 自動 / CDN: Edge      │
              └──────────────────┬──────────────────────────┘
                                 │
              ┌──────────────────▼──────────────────────────┐
              │         Next.js 14 App Router                │
              │   Middleware（認証チェック・ロール確認）       │
              │   /api/v1/*（外部API連携・将来）              │
              └────────────────┬────────────────────────────┘
                               │
              ┌────────────────▼────────────────────────────┐
              │              Supabase（無料）                 │
              │  ┌──────────────┐  ┌────────────────────┐  │
              │  │  Auth        │  │  PostgreSQL DB     │  │
              │  │  メール認証  │  │  + RLS（行レベル   │  │
              │  │  OAuth（将来）│  │    セキュリティ）  │  │
              │  └──────────────┘  └────────────────────┘  │
              │  ┌──────────────┐                           │
              │  │  Storage     │                           │
              │  │  書類PDF等   │                           │
              │  └──────────────┘                           │
              └─────────────────────────────────────────────┘
```

---

## 3. 無料枠と100名利用時の目安

| リソース | 無料上限 | 100名・月次推計 | 余裕 |
|---------|---------|--------------|-----|
| Supabase DB | 500MB | 〜50MB | ✅ 十分 |
| Supabase MAU | 50,000 | 〜150名（社員+顧客） | ✅ 十分 |
| Supabase Storage | 1GB | 〜300MB | ✅ 十分 |
| Supabase Edge Function | 500K回/月 | 〜10K回 | ✅ 十分 |
| Vercel 帯域 | 100GB/月 | 〜5GB/月 | ✅ 十分 |

> 100〜150名規模では**無料枠で十分に運用可能**。

---

## 4. 有料プランへの移行（設定変更のみ・コード変更不要）

### Supabase Free → Pro（$25/月）
```
Supabase Dashboard → Settings → Billing → Upgrade to Pro
→ クレジットカード登録のみ。データ移行不要。
```
- DBサイズ 8GB、MAU 100,000、バックアップ 7日分 へ拡張
- 超過分のみ従量課金

### Vercel Hobby → Pro（$20/月）
```
Vercel Dashboard → Settings → Billing → Upgrade to Pro
→ ドメイン・デプロイ設定の変更不要。
```

> **どちらも移行時のダウンタイムなし・データ移行なし**

---

## 5. ドメイン・HTTPS設定

### DNS設定（Xserver ドメイン管理から設定）

```
# Xserver → salud.co.jp の DNS設定
admin.salud.co.jp  CNAME  cname.vercel-dns.com
```

### Vercel 設定手順
1. Vercel Dashboard → プロジェクト → Settings → Domains
2. `admin.salud.co.jp` を追加
3. SSL証明書は Vercel が自動発行・自動更新

---

## 6. 権限管理設計（RBAC）

### ロール定義

| ロール | 対象 | 主な権限 |
|-------|------|---------|
| `admin` | 管理者 | 全データ・全操作・メンバー管理 |
| `manager` | マネージャー | 全顧客・案件 閲覧/編集（削除可） |
| `staff` | 一般社員 | 担当顧客・案件のみ 閲覧/編集 |
| `customer` | 顧客（将来） | 自社情報・補助金申請状況のみ閲覧 |

### 実装方式

```
Supabase Auth（メール/パスワード）
  └── user_metadata: { role: "admin" | "manager" | "staff" | "customer" }
       │
       ├── Next.js Middleware → ルート保護（認証チェック）
       │
       └── PostgreSQL RLS（行レベルセキュリティ）
            └── auth.uid()、auth.jwt() で直接紐付け
```

---

## 7. PostgreSQL RLS（行レベルセキュリティ）設計

```sql
-- 顧客テーブル例
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- admin・manager は全件アクセス
CREATE POLICY "managers can access all customers" ON customers
  FOR ALL USING (
    (auth.jwt() ->> 'role')::text IN ('admin', 'manager')
  );

-- staff は担当顧客のみ
CREATE POLICY "staff can access assigned customers" ON customers
  FOR SELECT USING (
    assigned_user_id = auth.uid()
    AND (auth.jwt() ->> 'role')::text = 'staff'
  );

-- customer ロールは自社情報のみ（将来）
CREATE POLICY "customers can view own company" ON customers
  FOR SELECT USING (
    id IN (
      SELECT customer_id FROM customer_users WHERE user_id = auth.uid()
    )
    AND (auth.jwt() ->> 'role')::text = 'customer'
  );
```

> RLS により **APIキーが漏洩しても他社・他ロールのデータにアクセス不可**

---

## 8. 外部API連携設計（将来）

```
GET  /api/v1/customers       顧客一覧（コーポレートサイト連携）
POST /api/v1/inquiries       問い合わせ受信（顧客ポータル連携）
POST /api/webhook/line       LINE Webhook
```

- 認証: Bearer トークン（Supabase Service Role Key）+ Vercel でIPホワイトリスト

---

## 9. デプロイフロー

```
開発者が git push → GitHub (main ブランチ)
    ↓ Vercel GitHub App が自動検知
Vercel がビルド・デプロイ（約1〜2分）
    ↓
admin.salud.co.jp に即時反映（ダウンタイムなし）
```

### 環境分離

| 環境 | URL | ブランチ |
|-----|-----|---------|
| 本番 | admin.salud.co.jp | main |
| プレビュー | *.vercel.app | PR・feature branch 毎に自動生成 |

---

## 10. 月額コスト

### 初期フェーズ（〜150名）

| サービス | プラン | 月額 |
|---------|-------|-----|
| Vercel | Hobby | **¥0** |
| Supabase | Free | **¥0** |
| GitHub | Free | **¥0** |
| **合計** | | **¥0/月** |

### ユーザー増加後

| サービス | プラン | 月額 |
|---------|-------|-----|
| Vercel | Pro | $20（約3,000円） |
| Supabase | Pro | $25（約3,800円） |
| **合計** | | **約7,000円/月** |

---

## 11. 環境変数

```env
# Supabase（公開可）
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx

# Supabase（サーバーのみ・公開不可）
SUPABASE_SERVICE_ROLE_KEY=xxxx
```

---

## 12. Phase 1 実装スコープ

- [x] 設計書更新（本ドキュメント）
- [x] `apps/admin` Next.js スキャフォールド
- [x] Supabase Auth 実装（メールログイン）
- [x] 認証ミドルウェア + ルート保護
- [x] ログインページ
- [x] サイドバー + ヘッダー レイアウト
- [x] ダッシュボード画面
- [ ] Supabase プロジェクト作成・スキーマ適用
- [ ] Vercel デプロイ + admin.salud.co.jp ドメイン設定
