'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const paths = require('../lib/paths');

// GET /api/student/profile
router.get('/profile', (req, res) => {
  try {
    if (!fs.existsSync(paths.studentProfile())) {
      return res.json({ success: true, profile: null });
    }
    const profile = JSON.parse(fs.readFileSync(paths.studentProfile(), 'utf8'));
    return res.json({ success: true, profile });
  } catch (err) {
    console.error('[student/profile]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/course/plan  (mounted on student router but path matches /api/course/plan via index)
router.get('/plan', (req, res) => {
  try {
    if (!fs.existsSync(paths.coursePlan())) {
      return res.json({ success: true, plan: null });
    }
    const plan = JSON.parse(fs.readFileSync(paths.coursePlan(), 'utf8'));
    return res.json({ success: true, plan });
  } catch (err) {
    console.error('[course/plan]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
