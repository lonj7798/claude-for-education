---
name: edu-chapter-designer
description: Design a chapter plan with source-linked content outline, quiz config, and buddy messages.
user-invocable: false
allowed-tools: Read, Write
---

# Chapter Designer

## Purpose

Takes the planner's decision (advance/remediate/adjust) plus resolved material content and produces the final chapter plan JSON with source-linked content outline. Extracted as a skill so the plan format stays consistent across iterations.

## When to Use

- After the planner has decided what to teach next and resolved source materials
- The planner invokes this with all the inputs already gathered

## Inputs

```
chapter_id={id}
planner_id={a|b|c}
title={chapter_title}
concepts={comma-separated concept names}
difficulty={1-10}
decision={advance|remediate|adjust}
approach={visual_with_examples|explanation_heavy|socratic_questioning|worked_examples|project_based|game_based}
materials={JSON array of resolved material sections from edu-material-reader}
student_profile_path={abs_path}
course_id={id}
project_root={abs_path}
```

## Workflow

### Step 1 — Read student profile

Read the student profile for: learning_mode, preferences, buddy_config, session_duration_minutes.

### Step 2 — Design content outline with source references

For each concept being taught, create 3-6 sections:

```json
{
  "section": "introduction",
  "description": "Engaging hook using visual counting with objects",
  "source_refs": ["sec_001"],
  "source_key_points": ["Definition of addition as combining groups"],
  "teaching_notes": "Use the textbook's apple example but simplify for this student's level"
}
```

Rules:
- Every section that draws from source materials MUST have `source_refs`
- `source_key_points` lists specific points from the source to emphasize
- `teaching_notes` gives the creator guidance on adaptation for THIS student
- If a section is from knowledge (no source material), use `source_refs: []` and explain in teaching_notes

### Step 3 — Configure quiz

Based on student preferences and difficulty:
- `question_count`: 4-8 (shorter for kids, longer for adults)
- `question_types`: match to topic (multiple_choice for all, code_input for programming, numeric_input for math)
- `passing_score`: 0.7 default, lower (0.5) for remedial chapters, higher (0.8) for review

### Step 4 — Configure buddy (if enabled)

If buddy_config.buddy_enabled in student profile:
```json
{
  "buddy_enabled": true,
  "encouragement_messages": {
    "quiz_high": "Amazing! {buddy_name} is doing a happy dance!",
    "quiz_mid": "Good effort! {buddy_name} knows you'll get it!",
    "quiz_low": "No worries! {buddy_name} says practice makes perfect!",
    "section_complete": "You finished that section! {buddy_name} is proud!",
    "idle_nudge": "Hey! {buddy_name} is here if you need help!"
  }
}
```

Replace `{buddy_name}` with the actual name from student profile.

### Step 5 — Write chapter plan JSON

Write to `teaching_process/plans/{chapter_id}_{planner_id}.json`:

```json
{
  "chapter_id": "{chapter_id}",
  "plan_id": "plan_{chapter_id}_v1",
  "course_id": "{course_id}",
  "title": "{title}",
  "difficulty": {difficulty},
  "student_level_at_plan_time": {from student history},
  "objectives": ["..."],
  "content_outline": [{sections with source_refs}],
  "teaching_approach": "{approach}",
  "learning_mode": "{from student profile}",
  "quiz_config": {quiz settings},
  "buddy_config": {buddy settings or null},
  "chat_enabled": true,
  "estimated_duration_minutes": {based on section count + student preference},
  "prerequisites_verified": false,
  "critic_approved": false,
  "critic_review": null,
  "evaluation_history_considered": [{list of eval_ids reviewed}],
  "decision": "{advance|remediate|adjust}",
  "decision_reason": "{why this decision was made}",
  "created_at": "{ISO 8601}"
}
```

## Output

Writes `teaching_process/plans/{chapter_id}_{planner_id}.json`.

## Error Handling

- No materials resolved → create plan with empty source_refs, note in teaching_notes
- Student profile missing buddy_config → skip buddy configuration
- Invalid difficulty → clamp to 1-10 range
