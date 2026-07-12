# TRPG Central

クトゥルフ神話TRPG(6版)を中心とした、TRPGの中央管理サイトです。
人間同士のセッション管理に加えて、**Claude がキーパー(GM)を務める AI GM プレイ**に対応しています。

## 機能

| 機能 | 説明 |
|---|---|
| 📜 探索者管理 | CoC 6版の探索者シートの作成・編集・削除。能力値ロール(3d6等)、派生値(SAN/HP/MP/アイデア/幸運/知識/DB)の自動計算、職業P/趣味Pの残量表示付き技能割り振り、カスタム技能、立ち絵アップロード |
| 🕯️ 卓(セッション)管理 | 卓の作成、日程・シナリオ・メモの管理、参加探索者の紐付け、ステータス遷移(募集中/進行中/終了) |
| 📖 シナリオライブラリ | シナリオの保存・管理・再利用。AI卓/人間卓のどちらからも参照可能。**AIシナリオ自動生成**(テーマ・舞台・ホラー度を指定するとClaudeが導入+真相+手がかり+結末分岐を生成) |
| 🎲 ダイスローラー | 1d100 / 3d6 / 任意のNdM±X。目標値付き技能判定(01–05クリティカル / 96–00ファンブル自動判定)、履歴50件 |
| 🐙 AI GMプレイ | Claude がキーパーとしてシナリオを進行するソロプレイ。ストリーミングチャット、判定・SANチェックはサーバー側でダイスを実行(tool use)、HP/MP/SANのリアルタイム表示、セッションの保存・再開 |
| 📈 成長チェック | セッション終了時に成功した技能の経験チェック(1d100 > 現在値で +1d10)。結果とHP/MP/SANをマスターシートに反映可能 |
| 📄 リプレイ書き出し | AI GMセッションのログを読み物風Markdownでダウンロード |
| 🎭 ココフォリア連携 | キャラシをココフォリアの駒(チャットパレット付き)としてクリップボードにコピー |

## 技術スタック

- [Next.js](https://nextjs.org/) (App Router) + TypeScript + Tailwind CSS
- [Prisma](https://www.prisma.io/) + SQLite (PostgreSQLへ移行可能な設計)
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) — モデル `claude-sonnet-5`、SSEストリーミング + tool use、prompt caching

## セットアップ

```bash
# 1. 依存関係のインストール
npm install

# 2. 環境変数の設定
cp .env.example .env
#   AI GM機能を使う場合は .env の ANTHROPIC_API_KEY を設定してください
#   (https://console.anthropic.com/ で取得。未設定でもAI GM以外は全機能動作します)

# 3. データベースの初期化
npx prisma migrate dev

# 4. 開発サーバー起動
npm run dev
```

http://localhost:3000 を開いてください。

> **Note**: AI GMの応答はロングランニングなSSEストリーミングです。実行時間制限のあるサーバーレス環境ではなく、ローカルまたはセルフホスト環境での利用を想定しています。立ち絵画像も `public/uploads/` に保存されるため、エフェメラルなファイルシステムの環境では永続しません(SQLiteと同じ制約です)。

## テスト

```bash
npm test        # vitest (ダイス・CoC6計算式・判定境界値のユニットテスト)
npm run lint    # ESLint
npm run build   # 本番ビルド
```

## AI GMの仕組み

- キーパー役のClaudeには、CoC 6版の進行ルールと探索者シート全文をシステムプロンプトとして渡します(安定部分は prompt caching でキャッシュ)
- 判定が必要な場面では、Claudeが以下のツールを呼び出し、**ダイスはすべてサーバー側で実行**されます:
  - `request_skill_check` — 技能判定 (1d100、クリティカル/ファンブル自動判定)
  - `san_check` — SANチェック (成功/失敗に応じた減少値ロールとSAN更新)
  - `roll_dice` — ダメージ等の汎用ロール
- 会話履歴はAPIのcontent blocks(thinking/tool_use含む)を無加工でDBに保存し、リロード後もセッションを完全に再開できます
- AIプレイ中のHP/MP/SANはセッション専用のスナップショットで管理され、マスターの探索者シートを直接書き換えません

## ライセンス

MIT
