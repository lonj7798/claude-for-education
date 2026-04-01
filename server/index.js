'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const paths = require('./lib/paths');

const app = express();

// Body parsing
app.use(express.json());

// Static files from server/static/
app.use(express.static(path.join(__dirname, 'static')));

// --- API routes ---
app.use('/api/quiz', require('./api/quiz'));
app.use('/api/chat', require('./api/chat'));
app.use('/api/session', require('./api/session'));
app.use('/api/student', require('./api/student'));
app.use('/api/course', require('./api/student')); // /api/course/plan shares student router
app.use('/api/progress', require('./api/progress'));

// --- Page routes ---

// GET / — landing page
app.get('/', (req, res) => {
  let settings = {};
  try {
    if (fs.existsSync(paths.settings())) {
      settings = JSON.parse(fs.readFileSync(paths.settings(), 'utf8'));
    }
  } catch (_) {}

  let coursePlan = null;
  try {
    if (fs.existsSync(paths.coursePlan())) {
      coursePlan = JSON.parse(fs.readFileSync(paths.coursePlan(), 'utf8'));
    }
  } catch (_) {}

  const currentChapter = settings.current_chapter || null;
  const lessonLink = currentChapter
    ? `<a href="/lesson/${encodeURIComponent(currentChapter)}">Go to current lesson: ${currentChapter}</a>`
    : '<em>No active lesson.</em>';

  const title = (coursePlan && coursePlan.title) || 'Claude for Education';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 60px auto; padding: 0 20px; }
    h1 { font-size: 2rem; }
    a { color: #0070f3; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="card">
    <h2>Current Lesson</h2>
    <p>${lessonLink}</p>
  </div>
  <div class="card">
    <h2>Links</h2>
    <ul>
      <li><a href="/dashboard">Progress Dashboard</a></li>
      <li><a href="/api/session/status">Session Status (JSON)</a></li>
      <li><a href="/api/student/profile">Student Profile (JSON)</a></li>
      <li><a href="/api/course/plan">Course Plan (JSON)</a></li>
    </ul>
  </div>
  <p style="color:#888;font-size:.85rem;">Server running — teaching_process: ${paths.TEACHING}</p>
</body>
</html>`);
});

// GET /lesson/:chapterId — serve chapter index.html from html_materials
app.get('/lesson/:chapterId', (req, res) => {
  const { chapterId } = req.params;
  const lessonDir = paths.htmlMaterials(chapterId);
  const indexFile = path.join(lessonDir, 'index.html');

  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  if (fs.existsSync(lessonDir)) {
    // Serve directory listing fallback
    return res.status(404).send(`<h2>No index.html found for chapter: ${chapterId}</h2><p>Directory exists at ${lessonDir}</p>`);
  }
  return res.status(404).send(`<h2>Chapter not found: ${chapterId}</h2><p>Expected at: ${lessonDir}</p>`);
});

// GET /dashboard — serve static dashboard
app.get('/dashboard', (req, res) => {
  const dashboardFile = path.join(__dirname, 'static', 'dashboard', 'index.html');
  if (fs.existsSync(dashboardFile)) {
    return res.sendFile(dashboardFile);
  }
  return res.status(404).send('<h2>Dashboard not yet available.</h2><p>Place index.html in server/static/dashboard/</p>');
});

// --- Start ---
let port = 3456;
try {
  if (fs.existsSync(paths.settings())) {
    const settings = JSON.parse(fs.readFileSync(paths.settings(), 'utf8'));
    if (settings.server_port) port = Number(settings.server_port);
  }
} catch (_) {}

app.listen(port, () => {
  console.log(`edu-server running at http://localhost:${port}`);
  console.log(`Teaching process: ${paths.TEACHING}`);
});
