'use strict';

const express = require('express');
const router = express.Router();
const { appendLine } = require('../lib/jsonl');
const paths = require('../lib/paths');

// POST /api/quiz/submit
router.post('/submit', (req, res) => {
  try {
    const { sessionId, chapterId, quizId, answers } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId required' });
    }
    const event = {
      type: 'quiz_submission',
      timestamp: new Date().toISOString(),
      sessionId,
      data: { quiz_id: quizId, answers: answers || [], score: null },
    };
    appendLine(paths.studentJsonl(sessionId), event);
    return res.json({ success: true, submitted: true });
  } catch (err) {
    console.error('[quiz/submit]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
