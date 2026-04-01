'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const paths = require('../lib/paths');

// GET /api/session/status
router.get('/status', (req, res) => {
  try {
    if (!fs.existsSync(paths.settings())) {
      return res.json({ success: true, status: null });
    }
    const settings = JSON.parse(fs.readFileSync(paths.settings(), 'utf8'));
    return res.json({ success: true, status: settings });
  } catch (err) {
    console.error('[session/status]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/session/current — human-readable current status
router.get('/current', (req, res) => {
  try {
    const statusPath = require('path').join(paths.TEACHING, 'current_status.json');
    if (!fs.existsSync(statusPath)) {
      return res.json({ success: true, status: null, message: 'No active session' });
    }
    const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    return res.json({ success: true, status });
  } catch (err) {
    console.error('[session/current]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/session/complete
router.post('/complete', (req, res) => {
  try {
    const { sessionId, chapterId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId required' });
    }

    const metaPath = paths.sessionMeta(sessionId);
    let meta = {};
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch (_) {}
    }

    meta.completion_status = 'completed';
    meta.completed_at = new Date().toISOString();
    if (chapterId) meta.chapterId = chapterId;

    const sessionsDir = require('path').dirname(metaPath);
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    fs.writeFileSync(paths.completedSignal(sessionId), '', 'utf8');

    return res.json({ success: true, completed: true });
  } catch (err) {
    console.error('[session/complete]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
