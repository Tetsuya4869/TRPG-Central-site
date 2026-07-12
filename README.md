# TRPG Central

クトゥルフ神話TRPG(6版・7版)対応の、TRPGの中央管理サイトです。
人間同士のセッション管理に加えて、**Claude がキーパー(GM)を務める AI GM プレイ**に対応しています。

## 機能

| 機能 | 説明 |
|---|---|
| 📜 探索者管理 | CoC **6版/7版**の探索者シート。能力値ロール、派生値の自動計算、技能割り振り、カスタム技能、立ち絵アップロード、複製 |
| 🕯️ 卓(セッション)管理 | 日程・シナリオ・メモ管理、参加探索者の紐付け、ステータス遷移、**⚔️ 戦闘トラッカー**(DEX順イニシアチブ・HP管理・ラウンド進行)、**🐙 AI KP補佐**(NPCセリフ案・描写案・裁定相談のチャット) |
| 📖 シナリオライブラリ | シナリオの保存・検索・タグ管理。**AIシナリオ自動生成**、**NPC・ハンドアウト資料**の添付(NPCはAI GMにも自動連携) |
| 🎲 ダイスローラー | 1d100 / 任意のNdM±X。6版/7版の技能判定(7版は成功度+**ボーナス/ペナルティダイス**)、探索者を選んでワンタップ判定、履歴 |
| 🐙 AI GMプレイ | Claude がキーパーとしてシナリオを進行。**最大4人パーティ対応**(全員のHP/MP/SANを個別管理)、判定・SANチェックはサーバー側でダイス実行(tool use)、6版/7版ルール対応、保存・再開 |
| 📈 成長チェック | セッション終了時にメンバーごとの経験チェック(1d100 > 現在値で +1d10)。結果とHP/MP/SANを各シートに反映可能 |
| 📊 プレイ統計 | セッションのSAN推移グラフ、出目分布、成功率・クリファン率、技能別成績 |
| 📄 リプレイ書き出し | AI GMセッションのログを読み物風Markdownでダウンロード |
| 🎭 ココフォリア連携 | キャラシをココフォリアの駒(チャットパレット付き)としてクリップボードにコピー |
| 💾 バックアップ | 探索者・シナリオ・プレイログを含む全データをJSONでエクスポート。探索者の複製にも対応 |

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
