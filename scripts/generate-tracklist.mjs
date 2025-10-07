import { promises as fs } from "node:fs";
import path from "node:path";

const audioDir = path.resolve("audio");
const manifestPath = path.resolve("audio/tracklist.json");

async function main() {
    const entries = await fs.readdir(audioDir, { withFileTypes: true });
    const tracks = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".mp3"))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, "ja"));

    if (tracks.length === 0) {
        console.warn("audio フォルダに MP3 が見つかりません。manifest を空で書き出します。");
    }

    const json = `${JSON.stringify(tracks, null, 2)}\n`;
    await fs.writeFile(manifestPath, json, "utf8");
    console.log(`✅ ${manifestPath} を更新しました (曲数: ${tracks.length})`);
}

main().catch((error) => {
    console.error("tracklist の生成に失敗しました", error);
    process.exitCode = 1;
});
