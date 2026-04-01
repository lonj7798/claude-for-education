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

// POST /api/student/xp
router.post('/xp', (req, res) => {
  try {
    const { xp } = req.body;
    if (typeof xp !== 'number') return res.status(400).json({ error: 'xp must be a number' });
    const profile = JSON.parse(fs.readFileSync(paths.studentProfile(), 'utf8'));
    if (!profile.buddy_state) profile.buddy_state = { buddy_xp: 0, buddy_level: 1 };
    profile.buddy_state.buddy_xp = (profile.buddy_state.buddy_xp || 0) + xp;
    profile.buddy_state.buddy_level = Math.floor(profile.buddy_state.buddy_xp / 100) + 1;
    profile.updated_at = new Date().toISOString();
    fs.writeFileSync(paths.studentProfile(), JSON.stringify(profile, null, 2));
    res.json({ success: true, buddy_state: profile.buddy_state });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update XP' });
  }
});

module.exports = router;
