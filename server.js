const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// audioディレクトリが存在しない場合は作成
const audioDir = path.join(__dirname, 'audio');
if (!fsSync.existsSync(audioDir)) {
    fsSync.mkdirSync(audioDir, { recursive: true });
}

// ファイルアップロードの設定
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, audioDir);
    },
    filename: (req, file, cb) => {
        // ファイル名をそのまま使用（UTF-8でデコード）
        cb(null, Buffer.from(file.originalname, 'latin1').toString('utf8'));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MBまで
    },
    fileFilter: (req, file, cb) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const ext = path.extname(originalName).toLowerCase();
        if (ext !== '.mp3') {
            return cb(new Error('MP3ファイルのみアップロード可能です'));
        }
        cb(null, true);
    }
});

// JSONパース（bodyの前に）
app.use(express.json());

// 静的ファイルの配信（audioフォルダも明示的に）
app.use('/audio', express.static(audioDir));
app.use(express.static(__dirname));

// 曲リストを取得するAPI
app.get('/api/tracks', async (req, res) => {
    try {
        const files = await fs.readdir(audioDir);
        const tracks = files
            .filter(file => file.toLowerCase().endsWith('.mp3'))
            .map(file => {
                // .mp3拡張子を除いてタイトルとする
                const title = file.replace(/\.mp3$/i, '');
                return {
                    title: title,
                    file: `/audio/${encodeURIComponent(file)}`
                };
            });
        res.json(tracks);
    } catch (error) {
        console.error('曲リスト取得エラー:', error);
        res.status(500).json({ error: '曲リストの取得に失敗しました' });
    }
});

// ファイルアップロードAPI
app.post('/api/upload', upload.single('audio'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'ファイルが選択されていません' });
        }
        res.json({
            message: 'アップロード成功',
            filename: req.file.filename
        });
    } catch (error) {
        console.error('アップロードエラー:', error);
        res.status(500).json({ error: 'アップロードに失敗しました' });
    }
});

// ファイル削除API
app.post('/api/delete', async (req, res) => {
    try {
        const { file } = req.body;
        if (!file || !file.startsWith('/audio/')) {
            return res.status(400).json({ error: '無効なファイルパスです' });
        }

        // URLデコードしてファイル名を取得
        const fileName = decodeURIComponent(file.replace('/audio/', ''));
        const filePath = path.join(audioDir, fileName);

        // セキュリティチェック：audioディレクトリ外へのアクセスを防ぐ
        if (!filePath.startsWith(audioDir)) {
            return res.status(400).json({ error: '無効なファイルパスです' });
        }

        await fs.unlink(filePath);
        res.json({ message: '削除成功' });
    } catch (error) {
        console.error('削除エラー:', error);
        res.status(500).json({ error: '削除に失敗しました' });
    }
});

// エラーハンドリング
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'ファイルサイズが大きすぎます（最大50MB）' });
        }
    }
    if (error.message === 'MP3ファイルのみアップロード可能です') {
        return res.status(400).json({ error: error.message });
    }
    console.error('サーバーエラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
});

app.listen(PORT, () => {
    console.log(`🎵 音楽プレーヤーサーバーが起動しました`);
    console.log(`🌐 http://localhost:${PORT} にアクセスしてください`);
});
