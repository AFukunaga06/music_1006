const playlistElement = document.getElementById("playlist");
const statusMessage = document.getElementById("status-message");
const currentTrackElement = document.getElementById("current-track");
const audioPlayer = document.getElementById("audio-player");
const trackTemplate = document.getElementById("track-template");

const uploadForm = document.getElementById("upload-form");
const fileInput = document.getElementById("file-input");
const uploadButton = document.getElementById("upload-button");
const selectedFileName = document.getElementById("selected-file-name");
const uploadMessage = document.getElementById("upload-message");

let tracks = [];
let buttons = [];
let currentIndex = -1;
let localMode = false;
let selectedFile = null;
let isUploading = false;

init();

audioPlayer.addEventListener("ended", () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < tracks.length) {
        playTrack(nextIndex);
        return;
    }

    currentIndex = -1;
    setActiveButton(null);
    currentTrackElement.textContent = "（未再生）";
});

audioPlayer.addEventListener("error", () => {
    statusMessage.textContent = "音声の読み込みに失敗しました。時間をおいて再試行してください。";
});

async function init() {
    setupUploadForm();
    await updateTrackList();
}

function setupUploadForm() {
    if (!uploadForm || !fileInput || !uploadButton) {
        return;
    }

    uploadForm.addEventListener("submit", handleUpload);
    fileInput.addEventListener("change", handleFileSelection);

    updateSelectedFileDisplay();
    updateUploadButtonState();
    updateUploadAvailability();
}

function updateUploadAvailability() {
    if (!uploadForm || !fileInput || !uploadButton) {
        return;
    }

    fileInput.disabled = !localMode;

    if (!localMode) {
        selectedFile = null;
        fileInput.value = "";
        updateSelectedFileDisplay();
        updateUploadButtonState();
        showUploadMessage("ローカルサーバーを起動すると楽曲を追加できます。", "info");
        return;
    }

    updateUploadButtonState();
    showUploadMessage("MP3ファイルを選択するとアップロードできます。", "info");
}

function updateSelectedFileDisplay(name) {
    if (!selectedFileName) {
        return;
    }

    if (!name) {
        selectedFileName.textContent = "ファイルが選択されていません";
        selectedFileName.hidden = true;
        return;
    }

    selectedFileName.textContent = name;
    selectedFileName.hidden = false;
}

function updateUploadButtonState() {
    if (!uploadButton) {
        return;
    }
    uploadButton.disabled = !localMode || !selectedFile || isUploading;
}

function showUploadMessage(text, type = "info") {
    if (!uploadMessage) {
        return;
    }

    uploadMessage.textContent = text;
    uploadMessage.className = `message ${type}`;
}

function handleFileSelection(event) {
    if (!fileInput) {
        return;
    }

    const [file] = event.target?.files ?? [];

    if (!localMode) {
        fileInput.value = "";
        selectedFile = null;
        updateSelectedFileDisplay();
        updateUploadButtonState();
        showUploadMessage("ローカルサーバーを起動すると楽曲を追加できます。", "info");
        return;
    }

    if (!file) {
        selectedFile = null;
        updateSelectedFileDisplay();
        updateUploadButtonState();
        return;
    }

    if (!isMp3File(file)) {
        fileInput.value = "";
        selectedFile = null;
        updateSelectedFileDisplay();
        updateUploadButtonState();
        showUploadMessage("MP3ファイルのみアップロードできます。", "error");
        return;
    }

    selectedFile = file;
    updateSelectedFileDisplay(file.name);
    updateUploadButtonState();
    showUploadMessage(`${file.name} をアップロードできます。`, "info");
}

async function handleUpload(event) {
    event.preventDefault();

    if (!localMode) {
        showUploadMessage("ローカルサーバーを起動すると楽曲を追加できます。", "info");
        return;
    }

    if (!selectedFile) {
        showUploadMessage("MP3ファイルを選択してください。", "error");
        return;
    }

    if (!uploadButton) {
        return;
    }

    try {
        isUploading = true;
        updateUploadButtonState();
        uploadButton.textContent = "アップロード中…";

        await uploadTrack(selectedFile);

        showUploadMessage(`${selectedFile.name} をアップロードしました。`, "success");
        fileInput.value = "";
        selectedFile = null;
        updateSelectedFileDisplay();
        await updateTrackList();
    } catch (error) {
        console.error("upload failed", error);
        const message = error instanceof Error ? error.message : "アップロードに失敗しました。時間をおいて再試行してください。";
        showUploadMessage(message, "error");
    } finally {
        isUploading = false;
        uploadButton.textContent = "アップロード";
        updateUploadButtonState();
    }
}

async function uploadTrack(file) {
    const formData = new FormData();
    formData.append("audio", file, file.name);

    const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        let message = "アップロードに失敗しました。";
        try {
            const data = await response.json();
            if (data && typeof data.error === "string") {
                message = data.error;
            }
        } catch {
            try {
                const text = await response.text();
                if (text) {
                    message = text;
                }
            } catch {
                // ignore secondary fetch errors
            }
        }
        throw new Error(message);
    }

    return response.json().catch(() => null);
}

async function updateTrackList() {
    const previousMode = localMode;
    const activeFile = currentIndex >= 0 && tracks[currentIndex] ? tracks[currentIndex].file : null;

    statusMessage.textContent = "曲リストを読み込んでいます…";

    try {
        const newTracks = await loadTrackList();
        tracks = newTracks;

        if (localMode !== previousMode) {
            updateUploadAvailability();
        }

        if (activeFile) {
            currentIndex = tracks.findIndex((track) => track.file === activeFile);
        } else if (!audioPlayer.src) {
            currentIndex = -1;
        }

        renderPlaylist();

        if (tracks.length === 0) {
            currentTrackElement.textContent = "（未再生）";
            statusMessage.textContent = localMode
                ? "アップロードされた曲がありません。MP3ファイルを追加してください。"
                : "音源ファイルが見つかりませんでした。";
            return;
        }

        if (currentIndex >= 0 && tracks[currentIndex]) {
            currentTrackElement.textContent = tracks[currentIndex].title;
        }

        const suffix = localMode ? "（ローカルモード）" : "";
        statusMessage.textContent = `${tracks.length} 曲を読み込みました${suffix}。`;
    } catch (error) {
        console.error(error);
        if (localMode !== previousMode) {
            updateUploadAvailability();
        }
        renderPlaylist();
        statusMessage.textContent = "曲リストを取得できませんでした。時間をおいて再読み込みしてください。";
    }
}

async function loadTrackList() {
    const localTracks = await fetchLocalTracks();
    if (localTracks !== null) {
        return localTracks;
    }

    localMode = false;

    const manifestTracks = await fetchManifest();
    if (manifestTracks.length > 0) {
        return manifestTracks;
    }

    return fetchFromGitHub();
}

async function fetchLocalTracks() {
    try {
        const response = await fetch("/api/tracks", { cache: "no-cache" });
        if (!response.ok) {
            if (response.status === 404) {
                localMode = false;
                return null;
            }
            localMode = true;
            return [];
        }

        const data = await response.json();
        localMode = true;
        if (!Array.isArray(data)) {
            return [];
        }
        return normalizeLocalTracks(data);
    } catch (error) {
        console.error("local fetch failed", error);
        localMode = false;
        return null;
    }
}

function normalizeLocalTracks(data) {
    return data
        .filter((item) => item && typeof item.file === "string")
        .map((item) => {
            const file = item.file;
            const title = typeof item.title === "string" && item.title.trim().length > 0
                ? item.title.trim()
                : formatTrackName(file.split("/").pop() ?? "");
            return { title, file };
        })
        .sort((a, b) => a.title.localeCompare(b.title, "ja"));
}

function renderPlaylist() {
    if (!playlistElement || !trackTemplate) {
        return;
    }

    playlistElement.innerHTML = "";

    if (tracks.length === 0) {
        playlistElement.innerHTML = '<p class="empty-message" role="note">曲がありません。MP3ファイルを追加してください。</p>';
        buttons = [];
        return;
    }

    buttons = tracks.map((track, index) => {
        const button = trackTemplate.content.firstElementChild.cloneNode(true);
        button.textContent = track.title;
        button.dataset.index = String(index);
        button.addEventListener("click", () => playTrack(index));
        playlistElement.appendChild(button);
        return button;
    });

    if (currentIndex >= 0 && currentIndex < buttons.length) {
        setActiveButton(buttons[currentIndex]);
    } else {
        currentIndex = -1;
        setActiveButton(null);
    }
}

function playTrack(index) {
    const track = tracks[index];
    if (!track) {
        return;
    }

    currentIndex = index;
    setActiveButton(buttons[index]);
    currentTrackElement.textContent = track.title;
    statusMessage.textContent = `${track.title} を再生中です。`;
    audioPlayer.src = track.file;

    const playPromise = audioPlayer.play();
    if (!playPromise || typeof playPromise.then !== "function") {
        return;
    }

    playPromise.catch((error) => {
        console.error(error);
        statusMessage.textContent = "音声を再生できませんでした。";
    });
}

function setActiveButton(button) {
    buttons.forEach((btn) => btn.classList.remove("active"));
    if (button) {
        button.classList.add("active");
    }
}

function formatTrackName(fileName) {
    return fileName
        .replace(/\.mp3$/i, "")
        .replace(/[\-_]+/g, " ")
        .trim();
}

async function fetchManifest() {
    try {
        const response = await fetch("audio/tracklist.json", { cache: "no-cache" });
        if (!response.ok) {
            return [];
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            return [];
        }
        return data
            .filter((name) => typeof name === "string" && name.toLowerCase().endsWith(".mp3"))
            .sort((a, b) => a.localeCompare(b, "ja"))
            .map((name) => ({
                title: formatTrackName(name),
                file: `audio/${encodeURIComponent(name)}`
            }));
    } catch (error) {
        console.error("manifest load failed", error);
        return [];
    }
}

async function fetchFromGitHub() {
    const GITHUB_API_URL = "https://api.github.com/repos/AFukunaga06/music_1006/contents/audio?ref=main";
    const RAW_BASE_URL = "https://raw.githubusercontent.com/AFukunaga06/music_1006/main/";

    try {
        const response = await fetch(GITHUB_API_URL, {
            headers: {
                Accept: "application/vnd.github+json"
            }
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json();

        return data
            .filter((item) => item.type === "file" && item.name.toLowerCase().endsWith(".mp3"))
            .map((item) => ({
                title: formatTrackName(item.name),
                file: buildRawUrl(RAW_BASE_URL, item.path)
            }))
            .sort((a, b) => a.title.localeCompare(b.title, "ja"));
    } catch (error) {
        console.error("GitHub fetch failed", error);
        return [];
    }
}

function buildRawUrl(baseUrl, path) {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}${encodedPath}`;
}

function isMp3File(file) {
    if (!file) {
        return false;
    }
    const type = typeof file.type === "string" ? file.type.toLowerCase() : "";
    const name = typeof file.name === "string" ? file.name.toLowerCase() : "";
    return type === "audio/mpeg" || name.endsWith(".mp3");
}
