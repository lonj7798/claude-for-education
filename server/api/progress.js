'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const paths = require('../lib/paths');

// GET /api/progress
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(paths.progressSummary())) {
      return res.json({ success: true, summary: null });
    }
    const summary = JSON.parse(fs.readFileSync(paths.progressSummary(), 'utf8'));
    return res.json({ success: true, summary });
  } catch (err) {
    console.error('[progress]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/progress/raw
router.get('/raw', (req, res) => {
  try {
    if (!fs.existsSync(paths.rawData())) {
      return res.json({ success: true, data: null });
    }
    const data = JSON.parse(fs.readFileSync(paths.rawData(), 'utf8'));
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[progress/raw]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/progress/evaluations
router.get('/evaluations', (req, res) => {
  try {
    const evalDir = paths.evaluations();
    if (!fs.existsSync(evalDir)) {
      return res.json({ success: true, evaluations: [] });
    }
    const files = fs.readdirSync(evalDir).filter((f) => f.endsWith('.json'));
    const evaluations = files.map((file) => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(evalDir, file), 'utf8'));
        return { file, ...content };
      } catch (_) {
        return { file, error: 'parse error' };
      }
    });
    return res.json({ success: true, evaluations });
  } catch (err) {
    console.error('[progress/evaluations]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
