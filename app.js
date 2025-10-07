const chooseFolderButton = document.getElementById("choose-folder");
const refreshButton = document.getElementById("refresh");
const addTracksButton = document.getElementById("add-tracks");
const playlistElement = document.getElementById("playlist");
const statusMessage = document.getElementById("status-message");
const audioPlayer = document.getElementById("audio-player");
const currentTrackElement = document.getElementById("current-track");
const trackTemplate = document.getElementById("track-template");

let directoryHandle = null;
let currentObjectUrl = null;
let activeButton = null;
let writeAccessGranted = false;

if (!("showDirectoryPicker" in window)) {
    chooseFolderButton.disabled = true;
    refreshButton.disabled = true;
    hideAddTracksButton();
    statusMessage.textContent = "このブラウザはフォルダ選択に対応していません。Chrome や Edge の最新版をご利用ください。";
}

if (!window.isSecureContext) {
    statusMessage.textContent = `${statusMessage.textContent} ローカルサーバー (例: python -m http.server) で開く必要があります。`;
}

chooseFolderButton?.addEventListener("click", async () => {
    if (!window.showDirectoryPicker) {
        return;
    }

    try {
        directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
        writeAccessGranted = false;
        writeAccessGranted = await requestPermission(directoryHandle, "readwrite");

        if (!writeAccessGranted) {
            // フォールバックで読み取り権限だけ確保する。
            await requestPermission(directoryHandle, "read");
            hideAddTracksButton();
            statusMessage.textContent = "読み取り専用でフォルダを開きました。ブラウザの権限を変更すると MP3 の追加が有効になります。";
        } else {
            showAddTracksButton();
        }

        refreshButton.disabled = false;
        await loadTracks();
    } catch (error) {
        if (error.name === "AbortError") {
            statusMessage.textContent = "フォルダ選択をキャンセルしました。";
        } else {
            console.error(error);
            statusMessage.textContent = "フォルダを開けませんでした。ブラウザの権限を確認してください。";
        }
    }
});

refreshButton.addEventListener("click", () => {
    if (!directoryHandle) {
        return;
    }
    loadTracks();
});

addTracksButton?.addEventListener("click", async () => {
    if (!directoryHandle || !writeAccessGranted) {
        return;
    }

    if (!window.showOpenFilePicker) {
        statusMessage.textContent = "このブラウザはファイル追加に対応していません。";
        return;
    }

    try {
        const handles = await window.showOpenFilePicker({
            multiple: true,
            excludeAcceptAllOption: true,
            types: [
                {
                    description: "MP3 ファイル",
                    accept: { "audio/mpeg": [".mp3"] }
                }
            ]
        });

        if (!handles.length) {
            statusMessage.textContent = "追加するファイルは選択されませんでした。";
            return;
        }

        statusMessage.textContent = `MP3 を追加しています… (${handles.length} 件)`;

        const results = await importTracks(handles);

        const successes = results.filter((result) => result.status === "fulfilled");
        const importedCount = successes.length;
        const renamedCount = successes.filter((result) => result.value.renamed).length;
        const failures = results.filter((result) => result.status === "rejected").length;

        let message;
        if (importedCount === 0 && failures > 0) {
            message = `${failures} 件のファイルはコピーに失敗しました。別のファイルでお試しください。`;
        } else {
            message = `${importedCount} 件の MP3 をコピーしました。`;
            if (renamedCount > 0) {
                message += ` ${renamedCount} 件は同名ファイルがあったため番号を付けて保存しました。`;
            }
            if (failures > 0) {
                message += ` ${failures} 件はコピーに失敗しました。`;
            }
        }

        statusMessage.textContent = message;
        await loadTracks();
    } catch (error) {
        if (error.name === "AbortError") {
            statusMessage.textContent = "ファイル追加をキャンセルしました。";
        } else {
            console.error(error);
            statusMessage.textContent = "ファイルを追加できませんでした。ブラウザの設定を確認してください。";
        }
    }
});

audioPlayer.addEventListener("ended", () => {
    setActiveButton(null);
    currentTrackElement.textContent = "（未再生）";
});

async function loadTracks() {
    if (!directoryHandle) {
        return;
    }

    statusMessage.textContent = "MP3 ファイルを読み込んでいます…";
    playlistElement.innerHTML = "";
    setActiveButton(null);

    const tracks = [];

    for await (const [name, handle] of directoryHandle.entries()) {
        if (handle.kind === "file" && name.toLowerCase().endsWith(".mp3")) {
            tracks.push({ name, handle });
        }
    }

    tracks.sort((a, b) => a.name.localeCompare(b.name, "ja"));

    if (tracks.length === 0) {
        statusMessage.textContent = "MP3 ファイルが見つかりませんでした。フォルダにファイルを追加してから『リストを更新』を押してください。";
        currentTrackElement.textContent = "（未再生）";
        clearAudioSource();
        return;
    }

    statusMessage.textContent = `${tracks.length} 件の MP3 を読み込みました。`;

    for (const track of tracks) {
        const button = trackTemplate.content.firstElementChild.cloneNode(true);
        button.textContent = formatTrackName(track.name);
        button.dataset.filename = track.name;
        button.addEventListener("click", () => playTrack(track, button));
        playlistElement.appendChild(button);
    }
}

async function playTrack(track, button) {
    try {
        const file = await track.handle.getFile();
        clearAudioSource();
        currentObjectUrl = URL.createObjectURL(file);
        audioPlayer.src = currentObjectUrl;
        await audioPlayer.play();
        currentTrackElement.textContent = button.textContent;
        setActiveButton(button);
        statusMessage.textContent = `${track.name} を再生中です。`;
    } catch (error) {
        console.error(error);
        statusMessage.textContent = "音声を再生できませんでした。別のファイルでお試しください。";
    }
}

function setActiveButton(button) {
    if (activeButton) {
        activeButton.classList.remove("active");
    }
    activeButton = button;
    if (activeButton) {
        activeButton.classList.add("active");
    }
}

function clearAudioSource() {
    // Revoke existing blob URLs to avoid leaking object URLs between tracks.
    if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
    }
    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();
}

function formatTrackName(fileName) {
    return fileName
        .replace(/\.mp3$/i, "")
        .replace(/[\-_]+/g, " ")
        .trim();
}

async function requestPermission(handle, mode) {
    if (!handle || !handle.queryPermission || !handle.requestPermission) {
        return false;
    }

    const opt = { mode };
    const current = await handle.queryPermission(opt);
    if (current === "granted") {
        return true;
    }
    if (current === "denied") {
        return false;
    }
    const result = await handle.requestPermission(opt);
    return result === "granted";
}

async function importTracks(fileHandles) {
    const tasks = fileHandles.map(async (fileHandle) => {
        const file = await fileHandle.getFile();
        const name = await getAvailableFileName(directoryHandle, file.name);
        const destinationHandle = await directoryHandle.getFileHandle(name, { create: true });
        const writable = await destinationHandle.createWritable();
        await writable.write(await file.arrayBuffer());
        await writable.close();
        const renamed = name !== file.name;
        return { original: file.name, savedAs: name, renamed };
    });

    return Promise.allSettled(tasks);
}

async function getAvailableFileName(directory, fileName) {
    const normalized = fileName.trim() || "track.mp3";
    const dotIndex = normalized.lastIndexOf(".");
    const base = dotIndex > 0 ? normalized.slice(0, dotIndex) : normalized;
    const extension = dotIndex > 0 ? normalized.slice(dotIndex) : "";

    let candidate = normalized;
    let counter = 1;

    while (await fileExists(directory, candidate)) {
        candidate = `${base} (${counter})${extension}`;
        counter += 1;
    }

    return candidate;
}

async function fileExists(directory, name) {
    try {
        await directory.getFileHandle(name, { create: false });
        return true;
    } catch (error) {
        if (error.name === "NotFoundError") {
            return false;
        }
        throw error;
    }
}

function hideAddTracksButton() {
    if (!addTracksButton) {
        return;
    }
    addTracksButton.hidden = true;
    addTracksButton.disabled = true;
}

function showAddTracksButton() {
    if (!addTracksButton) {
        return;
    }
    addTracksButton.hidden = false;
    addTracksButton.disabled = false;
}
