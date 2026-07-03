# Phase 1 セットアップ手順

## 1. Firebase プロジェクト作成（10分）

### 1-1. Firebase Console でプロジェクト作成
1. https://console.firebase.google.com/ を開く
2. 「プロジェクトを追加」→ プロジェクト名: `salud-admin`
3. Google アナリティクスは「無効」でOK → 「プロジェクトを作成」

### 1-2. Authentication を有効化
1. 左メニュー「Authentication」→「始める」
2. 「Sign-in method」→「メール/パスワード」→ 有効にして保存

### 1-3. Firestore Database を作成
1. 左メニュー「Firestore Database」→「データベースの作成」
2. ロケーション: `asia-northeast1`（東京）
3. 「本番環境モードで開始」→ 有効化

### 1-4. Web アプリを登録して設定値を取得
1. プロジェクトのホームページ → 「</>」（Web）アイコンをクリック
2. アプリのニックネーム: `salud-admin-web` → 「アプリを登録」
3. 表示される `firebaseConfig` の値をコピー

---

## 2. 環境変数を設定（3分）

```bash
cd apps/admin
cp .env.local.example .env.local
```

`.env.local` を開いて Firebase の値を貼り付ける：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=salud-admin.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=salud-admin
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=salud-admin.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## 3. 最初のユーザーを作成（3分）

Firebase Console → Authentication → 「ユーザーを追加」
- メールアドレス: `admin@salud.co.jp`
- パスワード: （任意）

---

## 4. ローカル開発サーバーを起動（2分）

```bash
# モノレポルートから
cd C:\Users\takus\OneDrive\ドキュメント\Salud
pnpm install
pnpm dev --filter=@salud/admin
```

ブラウザで http://localhost:3000 を開く

---

## 5. Vercel にデプロイ（10分）

### 5-1. Vercel アカウント作成・GitHubと連携
1. https://vercel.com/signup → GitHub でサインアップ

### 5-2. GitHub にプッシュ
```bash
cd C:\Users\takus\OneDrive\ドキュメント\Salud
git init
git add .
git commit -m "feat: Phase 1 基盤構築"
git remote add origin https://github.com/<your-org>/salud-admin.git
git push -u origin main
```

### 5-3. Vercel でプロジェクトをインポート
1. Vercel Dashboard → 「Add New Project」
2. GitHub リポジトリを選択
3. Root Directory: `apps/admin`
4. 環境変数（Environment Variables）に `.env.local` の内容を貼り付ける
5. 「Deploy」

### 5-4. カスタムドメインを設定
1. Vercel Dashboard → プロジェクト → Settings → Domains
2. `admin.salud.co.jp` を入力 → Add
3. 表示された CNAME レコードを Xserver の DNS に設定:
   ```
   admin.salud.co.jp  CNAME  cname.vercel-dns.com
   ```
4. DNS反映後（数分〜1時間）、HTTPS で自動的にアクセス可能になる

---

## 完了後の確認

- [ ] http://localhost:3000/login でログイン画面が表示される
- [ ] Firebase で作成したメールアドレス・パスワードでログインできる
- [ ] ダッシュボードが表示される
- [ ] https://admin.salud.co.jp でアクセスできる（Vercel デプロイ後）
