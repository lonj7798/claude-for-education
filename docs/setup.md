# Education System Setup

This document is read by the orchestrator ONLY when `setup_complete` is `false` in `teaching_process/settings.json`. Once setup completes, the orchestrator skips this entirely.

---

## Prerequisites

- Node.js installed (for the Express server)
- The `server/` directory has `node_modules/` (run `cd server && npm install` if not)

---

## Setup Checklist

The orchestrator executes these steps in order. Each step updates `teaching_process/settings.json` to track progress.

### Step 1 — Student Onboarding

Invoke **Skill: `/edu-setup`**

This interactive wizard collects:
- Topic or learning materials (any format: PDF, text, URL)
- Education level (elementary → professional)
- Age group (child / teen / adult)
- Learning mode (chat / tests / assignments / mixed)
- Difficulty preference (challenging / balanced / gentle)
- Buddy companion preferences (enable/disable, character, name, personality)

**Output:** `teaching_process/student_profile.json` populated with all student data.

If the student is unsure about their goals, edu-setup will invoke `/edu-goal-clarifier` automatically.

### Step 2 — Goal Clarification (if needed)

Invoke **Skill: `/edu-goal-clarifier`** (only if goals are unclear after Step 1)

Socratic interview — asks ONE question per round, scores 4 clarity dimensions, exits when ambiguity ≤ 20%.

**Output:** `teaching_process/student_profile.json` updated with clarified goals and milestones.

### Step 3 — Material Analysis

Invoke **Agent: `edu-researcher`** with: `topic={topic} materials_path={abs_path_to_materials_markdown} project_root={abs_path}`

The researcher:
- Reads pre-processed materials from `teaching_process/materials_markdown/`
- If no materials: uses own knowledge + WebSearch for the topic
- Maps all concepts, dependencies, difficulty levels
- Builds concept graph

**Output:** `teaching_process/research_briefs/{topic_slug}.json`

### Step 4 — Initialize Course Plan

After the researcher completes:
- Verify all required files exist:
  - `teaching_process/student_profile.json` (has student_id, topic, goals)
  - `teaching_process/course_plan.json` (has course_id, topic)
  - `teaching_process/research_briefs/{topic_slug}.json` (has concepts)
- If any are missing, re-run the failed step.

### Step 5 — Finalize Setup

1. Set `teaching_process/settings.json`:
   - `setup_complete: true`
   - `status: "waiting"`
   - `buddy_mode`: from student profile's `buddy_config.buddy_enabled`
   - `created_at`: current timestamp
   - `updated_at`: current timestamp

2. Initialize `teaching_process/loop_state.json`:
   ```json
   {
     "loop_iteration": 1,
     "current_step": "plan",
     "steps_completed": {
       "setup": true,
       "plan": false,
       "critic_review": false,
       "create": false,
       "teach": false,
       "evaluate": false,
       "replan": false
     },
     "current_chapter_id": null,
     "current_session_id": null,
     "last_completed_step_at": "<now>",
     "retry_counts": {"plan": 0, "critic_review": 0, "create": 0, "teach": 0, "evaluate": 0},
     "error_log": []
   }
   ```

3. Print:
   ```
   === Education System Ready ===
   Student: {name or student_id}
   Topic: {topic} ({sub_topic})
   Level: {education_level} ({age_group})
   Mode: {learning_mode}
   Buddy: {enabled/disabled} {buddy_name if enabled}
   Chapters planned: {total_chapters_planned}
   Starting point: {recommended_starting_point from research brief}
   Status: Waiting for first session
   ```

---

## After Setup

Once `setup_complete` is `true`, the orchestrator never reads this file again. It proceeds directly to the Education Loop in CLAUDE.md (Step 1: Plan).

The student or parent can re-run setup by setting `setup_complete: false` in `teaching_process/settings.json`. This resets the system for a new course (existing data is preserved but a new course begins).
