'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Append one JSON object as a line to a JSONL file.
 * Creates the file (and parent directories) if they don't exist.
 */
function appendLine(filePath, obj) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(filePath, JSON.stringify(obj) + '\n', 'utf8');
}

/**
 * Read all lines from a JSONL file, parse each, return array.
 * Returns [] if file doesn't exist or is empty.
 */
function readAll(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return [];
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (_) {
          return null;
        }
      })
      .filter((entry) => entry !== null);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * Read lines from a JSONL file where entry.timestamp > sinceTimestamp.
 * sinceTimestamp is an ISO string (or anything comparable with >).
 */
function readSince(filePath, sinceTimestamp) {
  const all = readAll(filePath);
  if (!sinceTimestamp) return all;
  return all.filter((entry) => entry.timestamp && entry.timestamp > sinceTimestamp);
}

/**
 * Read both JSONL files, merge into a single array sorted by timestamp ascending.
 */
function mergeTwoFiles(file1, file2) {
  const a = readAll(file1);
  const b = readAll(file2);
  return [...a, ...b].sort((x, y) => {
    if (!x.timestamp) return -1;
    if (!y.timestamp) return 1;
    return x.timestamp < y.timestamp ? -1 : x.timestamp > y.timestamp ? 1 : 0;
  });
}

module.exports = { appendLine, readAll, readSince, mergeTwoFiles };
