---
name: edu-quiz-analyzer
description: Analyze quiz submission data — score patterns, time analysis, question-level breakdown, and misconception detection.
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# Edu Quiz Analyzer

## Purpose
Deep analysis of quiz results from a session. Goes beyond simple score calculation — identifies patterns like which question types the student struggles with, time spent per question, common misconceptions revealed by wrong answers, and score comparison to the passing threshold defined in the chapter plan.

## When to Use
Invoked by edu-evaluator after a quiz submission event is detected in the session JSONL. Always called before edu-score-calculator so composite scoring has quiz data available.

## Inputs
- `session_id` — ID of the current teaching session
- `quiz_answers_path` — absolute path to the quiz answer key JSON (e.g. `teaching_process/quiz_answers.json`)
- `student_jsonl_path` — absolute path to the student JSONL event log
- `project_root` — absolute path to the project root

## Workflow

### Step 1 — Load Student Events
Read the student JSONL file at `student_jsonl_path`. Parse each line as JSON. Filter to events where `type === "quiz_submission"` and `session_id` matches. If no such events are found, return `{status: "no_quiz_data"}` immediately.

### Step 2 — Load Answer Key
Read `quiz_answers_path`. Parse the JSON. If the file is missing or unreadable, set `answer_key = null` and proceed in raw-score-only mode (no misconception analysis, no explanations).

### Step 3 — Per-Question Analysis
For each question in the submission:
- Determine correctness by comparing `student_answer` to the matching entry in `answer_key`.
- Compute time spent: subtract the previous question's timestamp from this question's timestamp. For the first question, use the quiz start timestamp from the event.
- If wrong and `answer_key` is available: record `student_answer`, `correct_answer`, `explanation`, and infer `likely_misconception` from the answer pattern (e.g., off-by-one → fence-post error; reversed operands → operation confusion).
- Record `question_type` and `difficulty` from the answer key entry if present.

### Step 4 — Aggregate Metrics
Compute the following across all questions:
- `total_score`: correct_count / total_questions (float, 0.0–1.0)
- `score_by_type`: group by `question_type`, compute per-type ratio of correct answers
- `average_time_per_question`: mean of all per-question durations in seconds
- `fastest_correct`: question with minimum time that was answered correctly
- `slowest_question`: question with maximum time regardless of correctness
- `misconceptions`: array of objects for each wrong answer (see Output schema)
- `passed`: `total_score >= passing_score` where `passing_score` is read from the chapter plan if accessible, else defaults to 0.7

### Step 5 — Derive Strengths and Weaknesses
- `strengths`: question types or patterns with score >= 0.8, or notably fast correct answers
- `weaknesses`: question types with score < 0.6, or questions that took more than 2x the average time

### Step 6 — Return Analysis
Return the structured JSON object. Do not write any files.

## Output
Returns structured JSON analysis object:
```json
{
  "quiz_score": 0.75,
  "score_by_type": {"multiple_choice": 0.8, "numeric_input": 0.6},
  "total_questions": 8,
  "correct": 6,
  "time_analysis": {
    "average_seconds": 22,
    "fastest": {"question_id": "q1", "seconds": 5},
    "slowest": {"question_id": "q5", "seconds": 45}
  },
  "misconceptions": [
    {
      "question_id": "q3",
      "student_answer": "5",
      "correct_answer": "7",
      "likely_misconception": "Student may be forgetting to carry in addition",
      "related_concept": "carrying_in_addition"
    }
  ],
  "passed": true,
  "strengths": ["quick_on_basic_problems", "strong_multiple_choice"],
  "weaknesses": ["slow_on_computation", "carrying_errors"]
}
```

## Error Handling
- No quiz_submission events in JSONL → return `{status: "no_quiz_data"}`
- `quiz_answers.json` missing or unreadable → proceed with raw score only; omit `misconceptions`, `score_by_type`, and `strengths`/`weaknesses` derived from question types
- Malformed quiz submission event (missing fields) → skip that question, increment `skipped_questions` counter in the result
- Timestamp missing on a question → exclude that question from time analysis only; still score it
- Division by zero (0 total questions) → return `{status: "no_quiz_data"}`
