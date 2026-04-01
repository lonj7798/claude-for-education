---
name: edu-evaluation-analyzer
description: Analyze all student evaluation history to build a trajectory profile — trends, strengths, weaknesses, and teaching approach effectiveness.
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# Evaluation Analyzer

## Purpose

Reads ALL evaluation files and produces a structured analysis of the student's learning trajectory. The planner uses this to decide: advance, remediate, or adjust approach. Extracted as a skill because the analysis logic is reusable and the planner shouldn't re-implement it each iteration.

## When to Use

- Before the planner designs a new chapter (every iteration)
- When the critic needs to verify a plan accounts for past weaknesses

## Inputs

`evaluations_path={abs_path_to_evaluations_dir} profile_path={abs_path_to_student_profile}`

## Workflow

### Step 1 — Read all evaluations

Read every `.json` file in `evaluations_path`, sorted by `evaluated_at` ascending. If directory is empty, return: `{"status": "first_iteration", "recommendation": "use_student_profile_defaults"}`.

### Step 2 — Build trajectory

For each evaluation, extract:
- Chapter and session IDs
- Overall score, quiz score, understanding, engagement, confidence
- Strengths and weaknesses arrays
- Recommendations (next_action, difficulty_adjustment, suggested_focus, suggested_approach)
- Adaptation suggestions

### Step 3 — Compute trends

Calculate:
- **Score trend**: improving / flat / declining (compare last 3 evaluations)
- **Consistent strengths**: topics appearing in strengths >= 2 times
- **Consistent weaknesses**: topics appearing in weaknesses >= 2 times
- **Best teaching approach**: which `teaching_approach` correlated with highest scores
- **Worst teaching approach**: which correlated with lowest scores
- **Engagement trend**: improving / flat / declining
- **Confidence trend**: improving / flat / declining

### Step 4 — Generate recommendation

Based on trends:
- If latest overall_score >= 0.8 AND understanding >= 0.7: recommend **advance**
- If latest quiz_score < 0.5 OR understanding < 0.5: recommend **remediate**
- If scores are OK but engagement < 0.5 or confidence < 0.5: recommend **adjust_approach**
- If declining trend over 3+ sessions: recommend **remediate** with different approach

### Step 5 — Return analysis

```json
{
  "status": "analyzed",
  "total_evaluations": 5,
  "latest_eval_id": "eval_ch_005_001",
  "score_trend": "improving",
  "engagement_trend": "stable",
  "confidence_trend": "improving",
  "consistent_strengths": ["basic_counting", "number_recognition"],
  "consistent_weaknesses": ["word_problems", "carrying"],
  "best_approach": "visual_with_examples",
  "worst_approach": "explanation_heavy",
  "recommendation": "advance",
  "recommendation_reason": "Scores consistently above 0.8, understanding strong.",
  "suggested_difficulty": 4,
  "suggested_approach": "visual_with_examples",
  "suggested_focus": "Introduction to carrying in addition",
  "avoid_approaches": ["explanation_heavy"],
  "latest_scores": {
    "overall": 0.85,
    "quiz": 0.88,
    "understanding": 0.82,
    "engagement": 0.90,
    "confidence": 0.75
  }
}
```

## Output

Returns structured JSON analysis. Does not write any files.

## Error Handling

- No evaluations → return first_iteration status
- Corrupted eval file → skip it, note in analysis
- Only 1 evaluation → can't compute trends, return latest scores only with recommendation based on thresholds
