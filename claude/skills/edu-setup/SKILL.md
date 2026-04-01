---
name: edu-setup
description: Interactive setup wizard for new students — collects topic, materials, level, learning mode, and buddy preferences.
user-invocable: true
allowed-tools: Read, Write, Bash, Grep, Glob, AskUserQuestion, WebFetch
---

# Edu Setup

## Purpose
First-time setup for a new student. Guides the student through an interactive interview to build their profile, collect learning materials, configure preferences, and initialize the course plan. Analogous to the setup phase in self-improvement systems.

## When to Use
- Student is starting for the first time and no `student_profile.json` exists
- Student explicitly requests a fresh setup or reset
- `teaching_process/settings.json` has `setup_complete: false` or is missing

## Workflow

### Step 1 — Welcome and Orient
Print a brief welcome message explaining the system: what it does, how sessions work, and what information is needed. Keep it friendly and concise — one short paragraph.

### Step 2 — Collect Topic or Materials
Ask: "What would you like to learn? You can describe a topic, paste a URL, or mention any files you'd like to upload."

- If the student provides a clear topic name: record it and continue.
- If the student provides a URL: fetch with WebFetch, extract main content, save as `teaching_process/materials_markdown/{slug}.md`.
- If the student uploads or references files: copy originals to `teaching_process/materials/`, then pre-process to markdown in `teaching_process/materials_markdown/`:
  - PDF: run `which pdftotext` — if available, run `pdftotext {file} {output}.md`; otherwise use the Read tool to extract text directly.
  - URLs: fetch with WebFetch, strip HTML boilerplate, save as `.md`.
  - Text or Markdown files: copy directly to `teaching_process/materials_markdown/`.
- If the student says "I don't know" or is unsure: invoke `/edu-goal-clarifier` skill and wait for it to return a resolved topic before continuing.

### Step 3 — Education Level
Ask: "What is your current education level?"
Accept one of: `elementary`, `middle`, `high`, `undergraduate`, `graduate`, `professional`, or `custom`.
If `custom`: ask them to describe it in one sentence and store the raw string.

### Step 4 — Age Group
Ask: "How would you describe your age group?"
Accept: `child` (under 12), `teen` (12–17), `adult` (18+).
Store as `age_group` in the profile.

### Step 5 — Learning Mode
Ask: "How would you prefer to learn?"
Present options:
- `chat only` — conversational lessons, no formal tests
- `tests only` — quizzes and exams, minimal lecture
- `assignments only` — projects and exercises
- `mixed` — a combination of all modes (recommended)
Store as `learning_mode`.

### Step 6 — Difficulty Preference
Ask: "How challenging would you like the material to be?"
Options: `challenging`, `balanced`, `gentle`.
Store as `difficulty`.

### Step 7 — Study Buddy
Ask: "Would you like a study buddy companion? This is a friendly character who encourages you during sessions. (Recommended for younger learners!)"

- If yes:
  - Ask character type: `fox`, `robot`, or `fairy`
  - Ask buddy name (student picks any name)
  - Ask personality: `cheerful`, `calm`, or `energetic`
  - Set `buddy_enabled: true` and populate `buddy_config: { character, name, personality }`
- If no:
  - Set `buddy_enabled: false`, `buddy_config: null`

### Step 8 — Generate Student ID and Write Profile
Generate `student_id` using format `student_{unix_timestamp}`.

Write `teaching_process/student_profile.json`:
```json
{
  "student_id": "student_1234567890",
  "topic": "...",
  "sub_topic": null,
  "education_level": "...",
  "age_group": "...",
  "learning_mode": "...",
  "difficulty": "...",
  "goals": [],
  "milestones": [],
  "buddy_enabled": true,
  "buddy_config": {
    "character": "fox",
    "name": "...",
    "personality": "cheerful"
  },
  "history_summary": {
    "total_sessions": 0,
    "average_quiz_score": null,
    "strongest_areas": [],
    "weakest_areas": [],
    "overall_understanding_level": null
  },
  "buddy_state": {
    "buddy_xp": 0,
    "buddy_level": 1
  },
  "prior_knowledge": [],
  "updated_at": "<ISO timestamp>",
  "created_at": "<ISO timestamp>"
}
```

### Step 9 — Write Course Plan and Settings
Write `teaching_process/course_plan.json`:
```json
{
  "topic": "...",
  "chapters": [],
  "status": "not_started"
}
```

Write `teaching_process/settings.json` (preserve any existing fields, merge):
```json
{
  "buddy_mode": true,
  "status": "setup",
  "setup_complete": false,
  "server_running": false,
  "port": 3456,
  "auto_open_browser": true,
  "session_timeout_minutes": 60
}
```

### Step 10 — Invoke Researcher Agent
Invoke the `edu-researcher` agent with arguments:
```
topic={topic}
materials_path={absolute_path_to_teaching_process/materials_markdown}
project_root={absolute_path_to_project_root}
```
Wait for the researcher to complete and generate a research brief.

### Step 11 — Finalize Setup
After researcher completes, update `teaching_process/settings.json`:
- Set `setup_complete: true`
- Set `status: "waiting"`

Initialize `teaching_process/loop_state.json`:
```json
{
  "loop_iteration": 1,
  "current_step": "plan",
  "steps": {
    "setup": {
      "completed": true,
      "started_at": null,
      "completed_at": null,
      "outputs": {}
    },
    "plan": {
      "completed": false,
      "started_at": null,
      "completed_at": null,
      "outputs": {}
    },
    "critic_review": {
      "completed": false,
      "started_at": null,
      "completed_at": null,
      "outputs": {}
    },
    "architect": {
      "completed": false,
      "started_at": null,
      "completed_at": null,
      "outputs": {}
    },
    "create": {
      "completed": false,
      "started_at": null,
      "completed_at": null,
      "outputs": {}
    },
    "teach": {
      "completed": false,
      "started_at": null,
      "completed_at": null,
      "outputs": {}
    },
    "evaluate": {
      "completed": false,
      "started_at": null,
      "completed_at": null,
      "outputs": {}
    },
    "replan": {
      "completed": false,
      "started_at": null,
      "completed_at": null,
      "outputs": {}
    },
    "record": {
      "completed": false,
      "started_at": null,
      "completed_at": null,
      "outputs": {}
    }
  }
}
```

Print: "Setup complete! Your personalized course is ready. Type 'start lesson' to begin."

## Output
- `teaching_process/student_profile.json` — full student profile
- `teaching_process/course_plan.json` — initial course plan with empty chapters
- `teaching_process/settings.json` — configured with buddy mode and status
- `teaching_process/loop_state.json` — initialized loop state
- `teaching_process/materials/` — original uploaded files
- `teaching_process/materials_markdown/` — pre-processed markdown versions
- Research brief generated by `edu-researcher` agent

## Error Handling
- If material parsing fails for a specific file: skip that file, print a warning noting which file was skipped, and continue with remaining files.
- If a URL fetch fails: note the failure and proceed without that source.
- If the `edu-researcher` agent fails or times out: log the failure but allow setup to complete — the planner will work from topic information alone.
- If the student provides an unrecognized education level: prompt once more with the valid options, then fall back to `custom` if still unrecognized.
