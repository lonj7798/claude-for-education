---
name: edu-chat-analyzer
description: Analyze chat conversation transcript — understanding signals, confusion patterns, engagement metrics, and topic coverage.
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# Edu Chat Analyzer

## Purpose
Deep analysis of the student-teacher chat conversation from a session. Identifies understanding signals (student explains correctly, asks follow-up questions), confusion signals (repeated questions, explicit statements of confusion), engagement patterns (response frequency, message length, initiation balance), and which plan objectives were actually covered in conversation versus which were never mentioned.

## When to Use
Invoked by edu-evaluator after a session ends, in parallel with or before edu-quiz-analyzer. Always called before edu-score-calculator so composite scoring has chat behavioral data available. If the session had no chat at all, returns a minimal result rather than blocking evaluation.

## Inputs
- `student_jsonl_path` — absolute path to the student JSONL event log
- `teacher_jsonl_path` — absolute path to the teacher JSONL event log
- `plan_path` — absolute path to the chapter plan JSON
- `project_root` — absolute path to the project root

## Workflow

### Step 1 — Load Chat Events
Read `student_jsonl_path` and `teacher_jsonl_path`. Parse each line as JSON. Filter both files to events where `event_type === "chat_message"`. If both files yield zero chat events, return `{status: "no_chat_data"}` immediately.

### Step 2 — Merge and Sort Chronologically
Merge student and teacher chat events into a single array. Add a `speaker` field (`"student"` or `"teacher"`) based on which file the event came from. Sort by `timestamp` ascending to reconstruct the full conversation flow.

### Step 3 — Load Chapter Plan
Read `plan_path` and parse it. Extract the `objectives` array and `concepts` list. These are used for topic coverage analysis. If plan is missing, skip topic coverage and note `"plan_unavailable"` in the result.

### Step 4 — Detect Understanding Signals
Scan student messages for positive understanding indicators:
- Student correctly rephrases a concept the teacher just explained
- Student uses phrases like "oh I see", "that makes sense", "got it", "so basically", "in other words"
- Student asks a follow-up question that builds on the prior explanation (deeper, not repetitive)
- Student provides their own example that correctly applies the concept
- Student answers a teacher check-question correctly

Each detected instance is recorded with timestamp and a short description.

### Step 5 — Detect Confusion Signals
Scan student messages for confusion indicators:
- Student asks the same or very similar question more than once
- Student uses phrases like "I don't understand", "I'm confused", "what?", "huh?", "I don't get it"
- Student asks about prerequisite concepts they should already know (cross-reference plan)
- Student gives an answer to a check-question that reveals a fundamental misunderstanding
- Very short responses ("ok", "yes", "no") following a complex explanation (possible passive non-engagement)

Each instance recorded with timestamp and description.

### Step 6 — Compute Engagement Metrics
- `total_messages`: count of all merged chat events
- `student_messages`: count of student events
- `teacher_messages`: count of teacher events
- `avg_student_message_length`: mean character count of student messages
- `response_frequency`: total messages / session_duration_minutes (if timestamps span enough range)
- `initiation_ratio`: fraction of exchanges initiated by the student (student message after silence > 30s)
- `question_quality`: "surface" if student only asks definitional questions; "deep" if student asks causal or application questions; "mixed" otherwise

### Step 7 — Analyze Topic Coverage
For each objective and concept from the chapter plan, check whether it appears (by keyword or close synonym) in any chat message. Build:
- `topics_discussed`: concept names that appeared in chat
- `topics_not_discussed`: concept names never mentioned (potential coverage gaps)

### Step 8 — Compute Derived Scores
- `understanding_level` (0.0–1.0): understanding_signal_count / (understanding_signal_count + confusion_signal_count + 1), normalized and clamped
- `engagement_level` (0.0–1.0): weighted combination of response_frequency, avg_student_message_length percentile, and initiation_ratio
- `confidence_level` (0.0–1.0): ratio of messages where student attempts an explanation or example vs. messages where student only asks for help

### Step 9 — Return Analysis
Return the structured JSON object. Do not write any files.

## Output
Returns structured JSON analysis object:
```json
{
  "understanding_level": 0.70,
  "engagement_level": 0.85,
  "confidence_level": 0.60,
  "total_messages": 12,
  "student_messages": 6,
  "teacher_messages": 6,
  "avg_student_message_length": 45,
  "understanding_signals": ["rephrased_correctly_2x", "asked_deep_followup"],
  "confusion_signals": ["repeated_question_about_carrying", "said_dont_understand_1x"],
  "topics_discussed": ["addition_concept", "counting_strategy"],
  "topics_not_discussed": ["number_line_usage"],
  "question_quality": "mixed",
  "notable_moments": [
    {
      "timestamp": "2024-01-01T10:05:00Z",
      "type": "breakthrough",
      "description": "Student correctly explained addition as combining groups"
    },
    {
      "timestamp": "2024-01-01T10:12:00Z",
      "type": "confusion",
      "description": "Student confused addition with multiplication"
    }
  ]
}
```

## Error Handling
- No chat messages in either JSONL → return `{status: "no_chat_data"}`
- Only teacher messages, student never chatted → return `{engagement_level: 0, understanding_level: 0, confidence_level: 0, status: "student_silent", total_messages: N, student_messages: 0}`
- Very short conversation (fewer than 3 total messages) → set `status: "insufficient_data"`, still compute best-effort scores from available messages, note low reliability
- Plan file missing → proceed without topic coverage; set `topics_discussed: null, topics_not_discussed: null, status_notes: ["plan_unavailable"]`
- Malformed event (missing timestamp or content) → skip that message for time-based metrics, still include in message counts
