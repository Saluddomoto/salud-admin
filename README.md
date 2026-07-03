# Salud 基幹システム

株式会社Saludの基幹システム。モノレポ構成で段階的に拡張していく。

## 構成

```
Salud/
├── apps/
│   ├── admin/      # 社内管理システム（MVP）
│   ├── portal/     # 顧客ポータル（将来）
│   └── api/        # APIサーバー（将来）
├── packages/
│   ├── ui/         # 共通UIコンポーネント
│   ├── database/   # Firestore型定義・サービス層
│   ├── auth/       # 認証ロジック
│   ├── ai/         # AIエージェント（将来）
│   ├── line/       # LINE連携（将来）
│   ├── google/     # Google連携（将来）
│   ├── notifications/ # 通知基盤（将来）
│   └── config/     # 共通ツール設定
└── docs/           # 設計書
```

## セットアップ

```bash
# 依存パッケージのインストール
pnpm install

# 環境変数の設定
cp .env.example apps/admin/.env.local
# .env.local にFirebaseの設定を記入

# 開発サーバー起動
pnpm dev
```

## 開発ロードマップ

| フェーズ | 内容 | 状態 |
|---------|------|------|
| MVP | 社内管理システム | 🚧 開発中 |
| v2 | Google連携 | 📋 計画中 |
| v3 | LINE連携・通知 | 📋 計画中 |
| v4 | AIエージェント | 📋 計画中 |
| v5 | 顧客ポータル | 📋 計画中 |
| v6 | 電子契約 | 📋 計画中 |
| v7 | 営業管理・補助金管理 | 📋 計画中 |
| v8 | 請求管理・会計連携 | 📋 計画中 |
