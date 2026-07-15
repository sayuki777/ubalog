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
