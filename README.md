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
| 💾 バックアップ | 探索者・シナリオ・プレイログを含む全データをJSONでエクスポート/**インポート(完全復元)**。旧形式バックアップの取り込みにも対応 |

## 技術スタック

- [Next.js](https://nextjs.org/) (App Router) + TypeScript + Tailwind CSS
- [Prisma](https://www.prisma.io/) + SQLite互換の [Cloudflare D1](https://developers.cloudflare.com/d1/) (driver adapter構成、ローカル開発はminiflareのローカルD1)
- 立ち絵画像は [Cloudflare R2](https://developers.cloudflare.com/r2/) に保存
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) — モデル `claude-sonnet-5`、SSEストリーミング + tool use、prompt caching
- [@opennextjs/cloudflare](https://opennext.js.org/cloudflare) で Cloudflare Workers にデプロイ

## セットアップ

```bash
# 1. 依存関係のインストール
npm install

# 2. 環境変数の設定
cp .env.example .env
#   AI GM機能を使う場合は .env の ANTHROPIC_API_KEY を設定してください
#   (https://console.anthropic.com/ で取得。未設定でもAI GM以外は全機能動作します)

# 3. データベースの初期化 (ローカルD1にスキーマ適用)
npx wrangler d1 migrations apply DB --local

# 4. 開発サーバー起動
npm run dev
```

http://localhost:3000 を開いてください。

> **Note**: AI GMの応答はロングランニングなSSEストリーミングです。データはD1、立ち絵画像はR2に保存されるため、Cloudflare Workers上でそのまま永続します。ローカル開発時は `.wrangler/state/` 配下のローカルD1/R2に保存されます。

## Cloudflareへのデプロイ (無償枠)

[@opennextjs/cloudflare](https://opennext.js.org/cloudflare) により Cloudflare Workers 上で動作します。データベースは D1、立ち絵画像は R2 を使います。いずれも無償枠の範囲で運用できます。

### 初回セットアップ

1. [Cloudflareダッシュボード](https://dash.cloudflare.com/) で以下を作成する
   - D1データベース `trpg-central-db` — 発行された Database ID を `wrangler.jsonc` の `database_id` に設定
   - R2バケット `trpg-central-uploads`
2. D1コンソールで `migrations/0001_init.sql` の内容を実行する (ローカルからなら `npx wrangler d1 migrations apply DB --remote`)
3. Workers & Pages → 作成 → **Gitに接続** でこのリポジトリを選び、ビルド設定を入れる
   - ビルドコマンド: `npx opennextjs-cloudflare build`
   - デプロイコマンド: `npx opennextjs-cloudflare deploy`
4. (任意) AI GM機能を使う場合は Workerの「設定 → 変数とシークレット」に `ANTHROPIC_API_KEY` を追加する

以後は対象ブランチへの push だけで自動デプロイされます。ローカルで本番同等の動作確認をするには `npm run preview` を使います。

### 無償枠の注意点

- Workersの無償枠は[1リクエストあたりCPU時間10ms](https://developers.cloudflare.com/workers/platform/limits/)。通常の操作(キャラ管理・ダイス・卓管理)はI/O待ちが大半のため収まる想定ですが、履歴が肥大したAI GMセッションでは超える可能性があります(Workers Paid $5/月でCPU 30秒に拡大)
- [D1の無償枠](https://developers.cloudflare.com/d1/platform/pricing/): 5GB / 読み取り500万行/日 / 書き込み10万行/日
- [R2の無償枠](https://developers.cloudflare.com/r2/pricing/): 保存10GB、下り転送は無料
- 公開URLになるため、自分専用にしたい場合は [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)(50ユーザーまで無料)でメール認証を掛けることを推奨します

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
