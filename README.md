# 音楽プレーヤー (music_1006)

GitHub Pages でホストしている 12 曲固定の音楽プレーヤーです。`audio/` ディレクトリに置いた MP3 ファイルを GitHub API 経由で読み込み、ブラウザ内で再生できます。

## デモ

- https://afukunaga06.github.io/music_1006/

ページを開くと自動的にプレイリストが生成され、タイトルをクリックするだけで再生が始まります。再生終了後は次の曲に順次移動します。

## プレイリストの更新方法

1. `audio/` ディレクトリに MP3 ファイルを追加または削除します。
2. `node scripts/generate-tracklist.mjs` を実行して `audio/tracklist.json` を更新します。
3. 変更をコミットして GitHub の `main` ブランチへプッシュします。
4. GitHub Pages に反映されると、新しいプレイリストが自動的に読み込まれます。

> 注記: manifest が取得できない環境では GitHub API (60 req/h) にフォールバックします。

## レンタルサーバー (共有ホスティング) での設置方法

1. このリポジトリの中身をそのままサーバーにアップロードします。`index.html`, `app.js`, `styles.css`, `audio/`, `api/` など、すべて同じ階層構造を維持してください。
2. サーバー側で PHP 7 以上が利用可能であれば、`api/tracks.php` が `audio/` ディレクトリを走査してプレイリストを自動生成します。アップロードした MP3 ファイルはブラウザを開くたびに最新の状態で読み込まれます。
3. PHP が利用できない場合は、`audio/tracklist.json` を手動で更新してください。`node scripts/generate-tracklist.mjs` をローカルで実行して生成したファイルをアップロードすると簡単に同期できます。
4. サイトをサブディレクトリに配置する場合 (`https://example.com/music/` など) でも、相対パスで音声ファイルを参照するよう調整しているためそのまま動作します。

> `api/tracks.php` は GET でアクセスすると MP3 の一覧を JSON で返します。必要に応じて `.htaccess` で `api/` ディレクトリを保護し、音声ファイル本体には適切なアクセス権限を設定してください。

## ローカルでの動作確認

```bash
python -m http.server 8000
# ブラウザで http://localhost:8000/ にアクセス
```

## 開発メモ

- 主要な UI ロジックは `app.js` にあります。まず `audio/tracklist.json` から曲リストを読み込み、取得できない場合は GitHub API から `audio/` 配下を参照します。
- スタイルは `styles.css` で定義しています。
- Node.js ベースのサーバー (`server.js`) はアップロード管理を行うローカル開発用です。GitHub Pages では使用しません。
