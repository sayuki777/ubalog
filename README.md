# ウバログ

配達記録、目標確認、ランキング、リアルタイム共有をスマホで確認するためのWebアプリです。

## 開発コマンド

```bash
npm install
npm run dev
npm run lint
npm run build
```

## テスト公開前の確認

- 開発起動: `npm run dev`
- lint: `npm run lint`
- ビルド確認: `npm run build`
- データ保存: 現在はブラウザの `localStorage`
- ロケナウOCR: ブラウザ側の無料OCR方式
- バックアップ: プロフィール画面からJSONを書き出し・読み込み

## Vercelメモ

Vercelへ公開する前に `npm run lint` と `npm run build` が通ることを確認します。
配達中テストの前には、プロフィール画面からバックアップを書き出しておくと安心です。
