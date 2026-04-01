---
name: edu-quiz-generator
description: Generate quiz questions from source material and chapter plan objectives.
user-invocable: false
allowed-tools: Read, Write, Grep, Glob
---

# Edu Quiz Generator

## Purpose
Generates quiz questions that test the chapter's specific learning objectives, drawing from organized source material sections. Produces two output files: `quiz_data.json` (client-safe, no answers) for delivery to the student interface, and `quiz_answers.json` (server-only) containing correct answers and explanations. Questions are calibrated to the chapter's difficulty level and question type configuration.

## When to Use
Invoked by edu-creator after the chapter content file has been written. Run once per chapter. Re-run if learning objectives change or if the quiz configuration in the chapter plan is updated.

## Inputs
- `plan_path` — absolute path to `teaching_process/chapter_plan.json`
- `materials_index_path` — absolute path to `teaching_process/materials_index.json`
- `chapter_id` — string identifier for the target chapter (e.g., `"ch_003"`)
- `output_dir` — absolute path to `html_materials/{chapter_id}/`
- `project_root` — absolute path to the project root

## Workflow

### Step 1 — Read Chapter Plan
Read `chapter_plan.json`. Locate the entry matching `chapter_id`. Extract:
- `objectives`: list of learning objective strings
- `quiz_config`: `{question_count, question_types: [], passing_score}`
- `source_refs`: list of `sec_{NNN}` IDs this chapter draws from
- `difficulty`: integer 1–10 for this chapter

If the chapter is not found, abort and return `{"status": "error", "reason": "chapter_id not found in plan"}`.

### Step 2 — Resolve Source Material
Read `materials_index.json`. For each ID in `source_refs`, locate the corresponding section metadata. Use Glob to find the actual section files in `teaching_process/materials_organized/`. Read each matched section file to retrieve body content, examples, and exercises blocks.

### Step 3 — Plan Question Distribution
Distribute `question_count` across `objectives` as evenly as possible (round-robin if not perfectly divisible). Distribute question types from `quiz_config.question_types` across questions — vary types rather than grouping them. Assign each question a unique ID: `q_{chapter_id}_{NNN}` (zero-padded to 3 digits).

### Step 4 — Generate Questions per Objective
For each objective, generate the assigned number of questions. Match the question type as planned:

**`multiple_choice`**: Write a clear, unambiguous question stem. Provide exactly 4 options labeled A–D. One option is correct; the other three are plausible distractors drawn from related but incorrect content in the source material (not random noise). Avoid "all of the above" and "none of the above" patterns.

**`multiple_select`**: Write a question stem indicating that multiple answers apply ("Select all that apply"). Provide 4–5 options. 2–3 are correct. Distractors are partially true or commonly confused alternatives from the material.

**`free_text`**: Write a short-answer question targeting one specific, unambiguous concept. The expected answer is a phrase or 1–2 sentences. Avoid questions where many valid phrasings exist unless the answer key notes acceptable variations.

**`code_input`**: Write a programming problem with a concrete spec (inputs, expected output). The student writes a function or expression. Include a sample input/output pair in the question body. Use only for programming-domain chapters.

**`numeric_input`**: Provide a computation problem with given values. The answer is a specific number (integer or decimal to 2 places). State units clearly. Use only for math/science chapters.

**Hints**: For each question, derive a hint from the source material's examples or key points. Hints should guide without revealing the answer. For remedial-difficulty chapters (difficulty 1–4), make hints more explicit. For advanced chapters (difficulty 7–10), hints should only point to the relevant concept area.

### Step 5 — Calibrate to Chapter Difficulty
- **Difficulty 1–4 (remedial)**: Use simple vocabulary matching the source text. Questions should closely mirror worked examples. More explicit hints. Avoid trick questions.
- **Difficulty 5–6 (standard)**: Mix recall and application questions. Hints are moderate. Novel but fair problem setups.
- **Difficulty 7–10 (advanced)**: Require synthesis across multiple concepts from source_refs. Minimal hints. Problems should differ meaningfully from source examples — students must transfer knowledge, not pattern-match.

### Step 6 — Write quiz_data.json
Write to `{output_dir}/quiz_data.json`. This file contains NO correct answers and is safe to send to the client:
```json
{
  "quizId": "{chapter_id}_quiz",
  "chapterId": "{chapter_id}",
  "passingScore": 0.75,
  "questions": [
    {
      "id": "q_ch_003_001",
      "type": "multiple_choice",
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "hint": "..."
    }
  ]
}
```
For `free_text`, `code_input`, and `numeric_input` types, omit the `options` field entirely.

### Step 7 — Write quiz_answers.json
Write to `{output_dir}/quiz_answers.json`. This file is server-only and must never be served to the client:
```json
{
  "quizId": "{chapter_id}_quiz",
  "answers": [
    {
      "id": "q_ch_003_001",
      "correct_answer": "B",
      "explanation": "..."
    }
  ]
}
```
For `multiple_select`, `correct_answer` is an array of option labels (e.g., `["A", "C"]`). For `free_text`, it is the expected answer string with a note on acceptable variations. For `numeric_input`, it is the numeric value as a string with the accepted tolerance (e.g., `"42.0 ± 0.5"`).

## Output
- `{output_dir}/quiz_data.json` — questions without answers (client-safe)
- `{output_dir}/quiz_answers.json` — answers and explanations (server-only)

## Error Handling
- **Source material has no exercises or examples**: generate questions from `key_points` in the section metadata and from the objective statements themselves. Note `"generated_from": "key_points"` in the answer explanation.
- **Requested question_count exceeds content capacity** (e.g., 20 questions for 2 short sections): cap at a reasonable number (roughly 3–5 per objective or 2 per source section, whichever is smaller). Record `"capped_at"` in a top-level `"meta"` field in both output files.
- **Question type not applicable** (e.g., `code_input` requested for a history chapter): substitute with `free_text` for that question slot. Note the substitution in `quiz_answers.json` explanation field.
- **output_dir does not exist**: create it with Write before writing output files.
- **chapter_id not found**: abort immediately with error JSON. Do not write partial output files.
