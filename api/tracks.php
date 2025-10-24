<?php
declare(strict_types=1);

$audioDir = dirname(__DIR__) . '/audio';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, max-age=0');

if (!is_dir($audioDir)) {
    http_response_code(404);
    echo json_encode(['error' => 'audio directory not found'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$tracks = [];

$handle = opendir($audioDir);
if ($handle === false) {
    http_response_code(500);
    echo json_encode(['error' => 'failed to read audio directory'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

while (($entry = readdir($handle)) !== false) {
    if ($entry === '.' || $entry === '..') {
        continue;
    }

    $filePath = $audioDir . '/' . $entry;
    if (!is_file($filePath)) {
        continue;
    }

    if (strtolower(pathinfo($entry, PATHINFO_EXTENSION)) !== 'mp3') {
        continue;
    }

    $title = preg_replace('/\.mp3$/i', '', $entry);
    $tracks[] = [
        'title' => $title,
        'file' => 'audio/' . rawurlencode($entry),
    ];
}

closedir($handle);

usort(
    $tracks,
    static function (array $a, array $b): int {
        return strcasecmp($a['title'], $b['title']);
    }
);

echo json_encode($tracks, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
