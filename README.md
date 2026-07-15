# ウバログ

配達員向けの売上記録アプリです。記録、ランキング、ニュース、リアルタイム共有をスマホ幅で確認できます。

## 開発コマンド

```bash
npm install
npm run dev
npm run lint
npm run build
```

## 公開メモ

- 公開URLはVercelのProduction Deployment URLです。
- GitHub URLはコード置き場です。
- Firebase共有は `ubalog_records` と `ubalog_realtime_offers` を対象にしています。
- Firebase設定がない場合も、ブラウザのlocalStorageで動作します。
- Firestore Rulesは本格運用前に締める必要があります。
- ロケナウOCRの補正や精度改善は公開後に改善します。

## Firebase

Firebase設定は任意です。使う場合は `.env.local` とVercel Environment Variablesに以下を設定します。

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
