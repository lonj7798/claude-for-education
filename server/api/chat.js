'use strict';

const express = require('express');
const router = express.Router();
const { appendLine, mergeTwoFiles, readSince } = require('../lib/jsonl');
const paths = require('../lib/paths');

// POST /api/chat/message
router.post('/message', (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId required' });
    }
    const event = {
      type: 'chat_message',
      timestamp: new Date().toISOString(),
      sessionId,
      sender: 'student',
      message,
    };
    appendLine(paths.studentJsonl(sessionId), event);
    return res.json({ success: true });
  } catch (err) {
    console.error('[chat/message]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/chat/messages/:sessionId
router.get('/messages/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = mergeTwoFiles(
      paths.studentJsonl(sessionId),
      paths.teacherJsonl(sessionId)
    );
    return res.json({ success: true, messages });
  } catch (err) {
    console.error('[chat/messages]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/chat/response/:sessionId?since=<iso>
router.get('/response/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const since = req.query.since || null;
    const entries = readSince(paths.teacherJsonl(sessionId), since);
    return res.json({ success: true, entries });
  } catch (err) {
    console.error('[chat/response]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
