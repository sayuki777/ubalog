# ウバログ

フードデリバリー配達員向けの売上記録アプリです。記録、ランキング、ニュース、リアルタイム共有をスマホ幅で確認できます。

## 開発コマンド

```bash
npm install
npm run dev
npm run lint
npm run build
```

## 公開メモ

- 公開URLは Vercel の Production Deployment URL です。
- GitHub URLはコード置き場です。
- Firebase共有は `ubalog_records` と `ubalog_realtime_offers` を対象にしています。
- Firebase設定がない場合も、ブラウザの localStorage で動作します。
- `/terms` に利用ルールを掲載しています。
- `/privacy` にプライバシー表示を掲載しています。
- Googleログインは使っていません。
- データ保存は localStorage と Firebase Firestore 共有を使っています。
- ロケナウOCRの補正や精度改善は公開後に改善します。
- OGP画像は `public/ogp.png` です。
- PWA manifest は `public/manifest.json` です。
- ホーム画面追加用アイコンは `public/icon-192.png` / `public/icon-512.png` です。
- 初回向けガイドは `components/BeginnerGuide.tsx` です。
- `/feedback` に不具合報告・要望導線を掲載しています。
- GoogleフォームURLは `NEXT_PUBLIC_UBALOG_FEEDBACK_FORM_URL` / `NEXT_PUBLIC_UBALOG_REQUEST_FORM_URL` で差し替え可能です。
- X投稿リンクからの報告も使えます。
- 本格デザインは後で差し替え可能です。
- `/test` に公開前チェックリストを掲載しています。
- チェック状態は localStorage に保存されます。
- 公開前に記録/ランキング/リアルタイム共有/ニュースを確認します。
- プロフィール画面からバックアップの書き出し/読み込みができます。
- 対象は localStorage の `ubalog-` 系データです。
- records は可能な範囲で重複排除してマージします。
- 本格的なアカウント同期は今後の検討です。
- `/recruit` は配達員登録リンクページです。
- Uber Eats / ロケットナウ / menu / 出前館への導線を掲載しています。
- menu招待コードのコピーに対応しています。
- 誇大表現を避けた初心者向け案内にしています。

## Firebase

Firebase設定は任意です。使う場合は `.env.local` と Vercel Environment Variables に以下を設定します。

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

詳しいメモは [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) を確認してください。

## 外部ニュース

必要に応じて以下を設定します。

```bash
NEWS_RSS_URL=
NEWS_API_PROVIDER=
NEWS_API_KEY=
```

## 管理メモ

- Vercel の環境変数に `NEXT_PUBLIC_UBALOG_ADMIN_KEY` を設定します。
- `?admin=管理キー` を付けてアクセスすると、その端末の localStorage に管理モードが保存されます。
- 管理モードでは、ランキング記録・リアルタイム共有・ニュースに小さな非表示ボタンが出ます。
- 非表示にしたデータは `hidden: true` を付け、ランキング、共有一覧、地図ピン、ニュース表示から除外します。
- これは公開後の最低限対応です。
- 本格運用では Firestore Rules、Firebase Auth、App Check などで保護を強化してください。

## 公開後の導線メモ

- マイページはニュース、初回ガイド、今日のサマリー、前日ランキング、個人成績、募集導線、ホーム画面追加、シェア導線の順で整理しています。
- 記録保存後は保存内容を短く表示し、保存日のランキングへ移動します。
- ランキングは期間/エリアフィルター、売上/時給/件数/単価タブ、単価ランキングへの導線を維持しています。
- リアルタイム共有は共有後にX共有、追加共有、単価ランキング確認へ進めます。
- 公開後も大きな機能追加より、記録・ランキング・共有の導線が迷いにくいことを優先します。
- ランキングの単価タブは、リアルタイム共有の1件あたり報酬金額が高い順です。
- 円/kmは参考表示として扱い、S/A/B/Cランクは距離と報酬の目安です。
- 単価ランキングへのリンクは `/ranking?tab=unitPrice` です。

## 表示確認用テストデータ

- `/test` には公開前チェックリストがあります。
- 管理者モード中だけ、表示確認用テストデータ作成カードが表示されます。
- テスト記録、テストリアルタイム共有、テストニュースには `isTestData: true` を付けます。
- テストデータ削除は `isTestData: true` のデータだけを対象にします。
- 本番データは削除しません。

## 公開前の安定化メモ

- localStorage のJSON読み込みは壊れた値でも初期値へ戻すようにしています。
- Firebase取得に失敗しても、端末内のlocalStorageデータで表示を続けます。
- ランキング、ニュース、リアルタイム共有は初期表示件数を抑えて、スマホで重くなりすぎないようにしています。
- OCRで読み取れない場合は、金額や件数を手入力できる流れを残しています。
- 固定要素とBottomMenuの重なり、横スクロールの有無は公開前に `/test` で確認します。
# ウバログ公開後メモ

- 記録画面では「昨日の記録をコピー」から、前日の稼働時間・休憩・件数・表示名・エリア・ランキング設定を引き継げます。
- コピー時は売上金額とコメントは引き継がず、選択中の日付はそのままです。
- よく使う稼働時間テンプレートを用意し、保存前に売上・件数・稼働時間の確認を表示します。
- 保存後は保存した日付に合わせてランキングへ移動します。
- マイページの目標タブでは、今月の売上目標、現在売上、残り金額、1日あたり目安を表示します。
- 目標は `ubalog-goals` に月ごと保存し、records集計から今月売上を計算します。
