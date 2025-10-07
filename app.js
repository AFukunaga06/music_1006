const playlistElement = document.getElementById("playlist");
const statusMessage = document.getElementById("status-message");
const currentTrackElement = document.getElementById("current-track");
const audioPlayer = document.getElementById("audio-player");
const trackTemplate = document.getElementById("track-template");

const GITHUB_API_URL = "https://api.github.com/repos/AFukunaga06/music_1006/contents/audio?ref=main";
const RAW_BASE_URL = "https://raw.githubusercontent.com/AFukunaga06/music_1006/main/";

let tracks = [];
let buttons = [];
let currentIndex = -1;

init();

audioPlayer.addEventListener("ended", () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < tracks.length) {
        playTrack(nextIndex);
        return;
    }
    setActiveButton(null);
    currentTrackElement.textContent = "（未再生）";
});

audioPlayer.addEventListener("error", () => {
    statusMessage.textContent = "音声の読み込みに失敗しました。時間をおいて再試行してください。";
});

async function init() {
    statusMessage.textContent = "曲リストを読み込んでいます…";
    try {
        tracks = await fetchTracks();
        if (tracks.length === 0) {
            statusMessage.textContent = "音源ファイルが見つかりませんでした。";
            return;
        }
        renderPlaylist();
        statusMessage.textContent = `${tracks.length} 曲を読み込みました。`;
    } catch (error) {
        console.error(error);
        statusMessage.textContent = "曲リストを取得できませんでした。時間をおいて再読み込みしてください。";
    }
}

async function fetchTracks() {
    const response = await fetch(GITHUB_API_URL, {
        headers: {
            Accept: "application/vnd.github+json"
        }
    });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    return data
        .filter((item) => item.type === "file" && item.name.toLowerCase().endsWith(".mp3"))
        .map((item) => ({
            title: formatTrackName(item.name),
            file: buildRawUrl(item.path)
        }))
        .sort((a, b) => a.title.localeCompare(b.title, "ja"));
}

function renderPlaylist() {
    playlistElement.innerHTML = "";
    buttons = tracks.map((track, index) => {
        const button = trackTemplate.content.firstElementChild.cloneNode(true);
        button.textContent = track.title;
        button.dataset.index = String(index);
        button.addEventListener("click", () => playTrack(index));
        playlistElement.appendChild(button);
        return button;
    });
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

function buildRawUrl(path) {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    return `${RAW_BASE_URL}${encodedPath}`;
}

function formatTrackName(fileName) {
    return fileName
        .replace(/\.mp3$/i, "")
        .replace(/[\-_]+/g, " ")
        .trim();
}
