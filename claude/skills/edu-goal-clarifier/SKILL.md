---
name: edu-goal-clarifier
description: Socratic interview to clarify learning goals when the student is unsure what to study.
user-invocable: true
allowed-tools: Read, Write, AskUserQuestion
---

# Edu Goal Clarifier

## Purpose
When a student says "I don't know what to learn" or provides materials without a clear goal, this skill conducts a brief Socratic interview to surface and crystallize their learning intent. It tracks four clarity dimensions mathematically and exits as soon as ambiguity drops below the threshold. Analogous to the `si-goal-clarifier` in self-improvement pipelines.

## When to Use
- Student responds to the topic question with "I don't know", "not sure", "anything", or similar non-answers
- Student provides materials (files, URLs) but no stated goal or topic
- `student_profile.json` has an empty or null `topic` field
- Invoked by `edu-setup` when topic resolution fails

## Workflow

### Step 1 — Load Context
Read `teaching_process/materials_markdown/` if any files exist. Skim their content to build background context that will inform question generation. Do not summarize aloud — use this context internally when formulating questions.

### Step 2 — Initialize Clarity Dimensions
Track four dimensions, each scored 0.0 to 1.0:

| Dimension | Measures |
|---|---|
| `subject_clarity` | What field or area is the student interested in? |
| `level_assessment` | Where is the student in their knowledge right now? |
| `goal_specificity` | What concrete outcome do they want to achieve? |
| `scope_definition` | How deep or broad should the learning go? |

Initialize all dimensions to `0.0`. Hard caps: max 8 rounds (soft), max 12 rounds (hard stop).

### Step 3 — Socratic Interview Loop
Repeat until ambiguity <= 0.20 or round limit reached:

**a. Select the weakest dimension.**
Find the dimension with the lowest score. In case of a tie, use priority order: `subject_clarity` > `level_assessment` > `goal_specificity` > `scope_definition`.

**b. Generate ONE targeted question.**
Craft a single, open-ended question that directly addresses the weakest dimension. Do not ask compound questions. Keep the tone conversational — avoid academic jargon.

Examples by dimension:
- Subject clarity: "What do you find yourself curious about lately, even outside of school or work?"
- Level assessment: "Have you studied anything related to this before, or would you be starting from scratch?"
- Goal specificity: "Imagine it's six months from now — what would you love to be able to do or understand?"
- Scope definition: "Are you looking for a broad overview, or do you want to go deep on one specific area?"

**c. Ask the student.**
Use AskUserQuestion to present the question and capture the response.

**d. Score all dimensions.**
Re-evaluate all four dimensions (0.0–1.0) based on ALL accumulated answers so far, not just the latest. Scores should only increase or hold, never decrease.

Scoring guide:
- 0.0: No information provided
- 0.3: Vague hints present
- 0.6: Partial clarity with gaps
- 0.8: Clear with minor ambiguity
- 1.0: Fully specified

**e. Calculate ambiguity.**
Use a weighted average of dimensions:
```
weighted_avg = (subject_clarity * 0.35) + (level_assessment * 0.20) + (goal_specificity * 0.30) + (scope_definition * 0.15)
ambiguity = 1.0 - weighted_avg
```

**f. Check exit condition.**
If `ambiguity <= 0.20`: exit loop.
If round >= 12: exit loop regardless.

### Step 4 — Synthesize Goal Statement
From all collected answers, synthesize a clear goal statement in 1–2 sentences. The statement should be specific enough to drive curriculum design. Format: "The student wants to [learn/achieve/understand] [specific thing] at a [level] level, with a focus on [scope]."

### Step 5 — Generate Milestones
Derive 3–5 concrete, measurable milestones from the goal statement. Each milestone should be a short phrase representing a checkpoint the student can verify themselves. Example: "Understand basic Python syntax and write simple scripts."

### Step 6 — Write to Profile
Read existing `teaching_process/student_profile.json` (or create it if absent). Merge in:
```json
{
  "topic": "<primary subject area>",
  "sub_topic": "<specific focus if identified, else null>",
  "goals": ["<synthesized goal statement>"],
  "milestones": [
    "<milestone 1>",
    "<milestone 2>",
    "<milestone 3>"
  ]
}
```
Write the updated file back. Do not overwrite other fields already present.

### Step 7 — Return to Caller
If invoked by `edu-setup`: return control silently. The topic is now resolved and setup continues from Step 3.
If invoked directly by the student: print the synthesized goal and milestones, then ask: "Does this capture what you're looking for?"

## Output
- `teaching_process/student_profile.json` updated with `topic`, `sub_topic`, `goals`, and `milestones`
- Clarity dimension scores (internal, not shown to student unless debugging)
- Synthesized goal statement and milestone list

## Error Handling
- If the student types "skip", "I don't care", or "whatever" at any point: immediately exit the loop. Set `topic` to the best guess from available materials context, or `"General Studies"` if none. Generate 3 generic milestones: "Build foundational understanding", "Apply concepts in practice", "Achieve independent competence".
- If the student provides only one-word answers for many rounds but clarity remains low: at round 6, gently note that more detail helps build a better course, and try one more specific prompt before accepting low-clarity results.
- If `student_profile.json` cannot be written: print an error message with the synthesized goal so the student can record it manually.
