---
name: edu-score-calculator
description: Compute composite evaluation scores from quiz and chat analyses, generate recommendations and adaptation suggestions.
user-invocable: false
allowed-tools: Read, Write
---

# Edu Score Calculator

## Purpose
Takes the output from edu-quiz-analyzer and edu-chat-analyzer, computes weighted composite scores, and generates actionable recommendations for the planner. Writes the final evaluation report and updates the student profile. This is the final synthesis step of the evaluation pipeline — it runs only after both analyzers have returned results.

## When to Use
Invoked by edu-evaluator as the last step of evaluation, after edu-quiz-analyzer and edu-chat-analyzer have both completed (or explicitly returned a no-data status). Requires at least one non-empty analysis to produce a meaningful result.

## Inputs
- `quiz_analysis` — JSON object returned by edu-quiz-analyzer (may have `status: "no_quiz_data"`)
- `chat_analysis` — JSON object returned by edu-chat-analyzer (may have `status: "no_chat_data"`)
- `plan_path` — absolute path to the chapter plan JSON
- `profile_path` — absolute path to `teaching_process/student_profile.json`
- `eval_id` — unique identifier for this evaluation report
- `session_id` — ID of the session being evaluated
- `project_root` — absolute path to the project root

## Workflow

### Step 1 — Load Supporting Files
Read `plan_path` to get `objectives`, `difficulty`, and `passing_score`. Read `profile_path` to get the student's current `history_summary`, `milestones`, and `buddy_state`. If either file is missing, note it and proceed with defaults.

### Step 2 — Determine Available Data Mode
Check which analyses have real data:
- Both available: `mode = "full"`
- Quiz only (`chat_analysis.status === "no_chat_data"`): `mode = "quiz_only"`
- Chat only (`quiz_analysis.status === "no_quiz_data"`): `mode = "chat_only"`
- Neither: `mode = "no_data"` — skip to Step 7 with minimal report

### Step 3 — Compute Composite Overall Score
Apply the formula matching the data mode:
- `full`: `overall_score = quiz_score * 0.4 + understanding_level * 0.3 + engagement_level * 0.15 + confidence_level * 0.15`
- `quiz_only`: estimate understanding from quiz patterns (misconception count inversely weighted); `overall_score = quiz_score * 0.6 + estimated_understanding * 0.4`
- `chat_only`: `overall_score = understanding_level * 0.5 + engagement_level * 0.25 + confidence_level * 0.25`

Clamp `overall_score` to [0.0, 1.0]. If any input value is NaN or undefined, substitute 0.5 and add `"anomaly_noted"` to result warnings.

### Step 4 — Merge Strengths and Weaknesses
Combine `strengths` and `weaknesses` arrays from both analyses. Deduplicate by string value. Rank weaknesses by frequency of appearance across both sources — items appearing in both analyses are surfaced first.

### Step 5 — Generate Recommendations
Determine `next_action`:
- `"advance"` if `overall_score >= 0.7` AND quiz `passed === true`
- `"practice_more"` if `overall_score >= 0.5` but not advance conditions
- `"remediate"` if `overall_score < 0.5`

Determine `difficulty_adjustment`:
- `"increase"` if `overall_score >= 0.85`
- `"maintain"` if `overall_score >= 0.6`
- `"decrease"` if `overall_score < 0.6`

Determine `suggested_focus`: the top item from ranked weaknesses list, or `null` if no weaknesses detected.

Determine `suggested_approach`: if engagement was high with long student messages → `"socratic_dialogue"`; if quiz showed strong multiple choice but weak numeric → `"worked_examples"`; if many confusion signals → `"scaffolded_steps"`; otherwise `"standard"`.

Set `ready_for_next_chapter = (next_action === "advance" && quiz.passed === true && understanding_level >= 0.6)`.

### Step 6 — Generate Adaptation Suggestions
If `ready_for_next_chapter === false`, build `adaptation_suggestions` array. Each item has:
- `type`: `"add_practice_chapter"` | `"adjust_difficulty"` | `"change_approach"`
- `reason`: specific phrase drawn from the analysis (e.g., "carrying_errors detected in 2 quiz questions")
- `suggested_chapter`: `{title, difficulty, focus}` — title and focus derived from top weakness, difficulty from `difficulty_adjustment`

If `ready_for_next_chapter === true`, set `adaptation_suggestions = []`.

### Step 7 — Compute Buddy XP Earned
`buddy_xp_earned = 10 + (quiz.correct * 5) + (chat.student_messages * 2)`
Use 0 for any component where the source analysis has no data.

### Step 8 — Update Student Profile
Read the current `student_profile.json` from `profile_path`. Apply the following mutations:
- `history_summary.average_quiz_score`: rolling average incorporating this session's `quiz_score` (skip if quiz_only mode has no raw score)
- `history_summary.overall_understanding_level`: rolling average incorporating `overall_score`
- `history_summary.strongest_areas`: replace with updated `strengths` list
- `history_summary.weakest_areas`: replace with updated ranked `weaknesses` list
- `buddy_state.buddy_xp`: add `buddy_xp_earned`; recalculate `buddy_level` (every 100 XP = 1 level)
- `milestones`: for each milestone whose `related_concept` appears in `topics_discussed` or quiz strengths, set `mastery = overall_score` if the new value is higher than current
- `updated_at`: set to current ISO timestamp

Write the updated profile back to `profile_path`.

### Step 9 — Write Evaluation Report
Construct the evaluation report object matching the schema defined in `data_contracts.md` section 5. Write it to `{project_root}/teaching_process/evaluations/{eval_id}.json`.

## Output
Two files are written:
- `teaching_process/evaluations/{eval_id}.json` — full evaluation report including overall_score, recommendations, adaptation_suggestions, quiz_analysis, chat_analysis, and buddy_xp_earned
- `teaching_process/student_profile.json` — updated with new history, buddy state, and milestone mastery

## Error Handling
- Both analyses empty (`mode = "no_data"`) → write minimal eval report with `overall_score: null`, `next_action: "practice_more"`, `status: "insufficient_data"`; skip profile update
- Profile file missing → write the evaluation report normally; skip all profile update steps; log `"profile_not_found"` in report warnings
- Profile missing `milestones` field → skip milestone update only; proceed with all other profile mutations
- Score calculation produces NaN → substitute 0.5 for that component, add `"score_anomaly"` to report warnings array
- Write failure on evaluation report → surface error to edu-evaluator caller; do not silently swallow
- Write failure on profile → surface warning but do not block; evaluation report takes priority
