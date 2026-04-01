# Data Contracts — Claude-for-Education

All JSON/JSONL schemas used by the education system. Agents must read and write files conforming to these schemas.

---

## 1. student_profile.json

**Location:** `teaching_process/student_profile.json`
**Writers:** edu-setup (initial), edu-evaluator (updates history + buddy XP)
**Readers:** All agents

| Field | Type | Description |
|-------|------|-------------|
| student_id | string | Unique student identifier |
| name | string\|null | Optional display name |
| education_level | enum | elementary\|middle\|high\|undergraduate\|graduate\|professional\|custom |
| custom_level_description | string\|null | Free text if level is "custom" |
| age_group | enum | child\|teen\|adult |
| topic | string | Main topic (e.g., "Mathematics") |
| sub_topic | string | Specific area (e.g., "Elementary Arithmetic") |
| goals | string[] | Learning objectives |
| milestones | object[] | `{id, description, status, mastery}` — mastery is 0.0-1.0 |
| learning_mode | enum | chat\|tests\|assignments\|mixed |
| preferences | object | `{language, difficulty_preference, session_duration_minutes, visual_learner, prefers_examples}` |
| buddy_config | object | `{buddy_enabled, buddy_character, buddy_name, buddy_personality}` |
| buddy_state | object | `{buddy_level, buddy_xp}` — persists across sessions |
| history_summary | object | `{total_sessions, average_quiz_score, strongest_areas, weakest_areas, overall_understanding_level}` |
| created_at | ISO 8601 | Creation timestamp |
| updated_at | ISO 8601 | Last update timestamp |

---

## 2. course_plan.json

**Location:** `teaching_process/course_plan.json`
**Writers:** edu-setup (initial), edu-planner (updates), orchestrator (re-plan)
**Readers:** All agents

| Field | Type | Description |
|-------|------|-------------|
| course_id | string | Unique course identifier |
| topic | string | Main topic |
| sub_topic | string | Specific area |
| student_id | string | Linked student |
| status | enum | not_started\|in_progress\|completed\|course_complete |
| completion_reason | string\|null | student_quit\|all_milestones_mastered\|max_chapters_reached\|planner_complete |
| chapters | object[] | Array of chapter objects (see below) |
| max_chapters | int | Configurable cap (default 50) |
| total_chapters_planned | int | Current number of planned chapters |
| chapters_completed | int | Count of completed chapters |
| current_chapter_id | string\|null | Active chapter |
| adaptation_log | object[] | `{timestamp, action, chapter_id, reason}` |
| created_at | ISO 8601 | Creation timestamp |
| updated_at | ISO 8601 | Last update timestamp |

**Chapter object:**
```json
{
  "chapter_id": "ch_001",
  "title": "Counting 1 to 10",
  "order": 1,
  "status": "completed|in_progress|planned|skipped",
  "difficulty": 1,
  "prerequisites": [],
  "objectives": ["Count from 1 to 10"],
  "estimated_sessions": 1,
  "actual_sessions": 1
}
```

---

## 3. Chapter Plan — `teaching_process/plans/{chapter_id}.json`

**Writers:** edu-planner (creates proposal), edu-critic (adds critic_review, selects winner), edu-architect (writes canonical plan with expansion)
**Readers:** edu-teacher, edu-evaluator

| Field | Type | Description |
|-------|------|-------------|
| chapter_id | string | Matches course_plan chapter |
| plan_id | string | Versioned plan ID |
| course_id | string | Parent course |
| title | string | Chapter title |
| difficulty | int | 1-10 scale |
| student_level_at_plan_time | float | 0.0-1.0 |
| objectives | string[] | What student should learn |
| content_outline | object[] | `{section, description}` |
| teaching_approach | string | e.g., "visual_with_examples" |
| learning_mode | string | From student preferences |
| quiz_config | object | `{question_count, question_types, passing_score}` |
| buddy_config | object\|null | `{buddy_enabled, encouragement_messages: {quiz_high, quiz_mid, quiz_low, section_complete, idle_nudge}}` |
| chat_enabled | boolean | Whether chat is available |
| estimated_duration_minutes | int | Expected session length |
| prerequisites_verified | boolean | Critic checks this |
| critic_approved | boolean | Set by edu-critic |
| critic_review | object | `{difficulty_appropriate, prerequisites_met, not_repeating_failed, aligned_with_goals, verdict, rejection_reason}` |
| evaluation_history_considered | string[] | eval_ids reviewed by planner |
| architect_expansion | object[] | Per-section detailed subsections with content_directives, visual_elements, interactive_elements, estimated_words, transition_notes, design_hints |
| architect_approved | boolean | Whether architect approved the plan |
| architect_review | object | `{verdict, structural_issues, pedagogical_flow_score, source_quality_score, quiz_design_score, student_fit_score, summary}` |
| design_hints | object | Per-section visual and interaction guidance for the creator |
| created_at | ISO 8601 | Creation timestamp |

---

## 3b. Planner Proposal — `teaching_process/plans/{chapter_id}_{planner_id}.json`

**Writers:** edu-planner
**Readers:** edu-critic, edu-architect (winning proposal only)

Identical to Chapter Plan schema (Section 3), plus these additional fields:

| Field | Type | Description |
|-------|------|-------------|
| planner_id | enum | planner_a\|planner_b\|planner_c |
| approach_strategy | string | conservative/proven, creative/experimental, or weakness-focused |
| approach_rationale | string | Why this approach is best for this student |
| expected_outcome | string | What student should achieve |
| risk | string | What could go wrong |
| differentiation | string | How this differs from other planners |

---

## 4. Session Files (JSONL Split Pattern)

Sessions use THREE files to avoid concurrent-write conflicts:

### `teaching_process/sessions/{session_id}.meta.json`

**Writers:** Server (creates on start, updates on complete)
**Readers:** edu-evaluator, orchestrator, dashboard

| Field | Type | Description |
|-------|------|-------------|
| session_id | string | Unique session ID |
| chapter_id | string | Which chapter |
| student_id | string | Which student |
| started_at | ISO 8601 | Session start |
| completed_at | ISO 8601\|null | Session end |
| completion_status | enum | completed\|timeout\|student_quit\|null |
| duration_minutes | int\|null | Total session time |
| server_port | int | Port used |
| quiz_results | object\|null | `{total_questions, correct, score, time_spent_seconds}` |
| chat_summary | object\|null | `{total_messages, student_messages, teacher_messages, topics_discussed}` |
| buddy_xp_earned | int | XP earned this session |

### `teaching_process/sessions/{session_id}.student.jsonl`

**Writer:** Express server ONLY (one JSON per line, append-only)

Line types:
```
{"type": "page_view", "timestamp": "...", "data": {"page": "introduction"}}
{"type": "chat_message", "timestamp": "...", "sender": "student", "message": "..."}
{"type": "quiz_submission", "timestamp": "...", "data": {"quiz_id": "...", "answers": [...], "score": 0.75}}
{"type": "buddy_interaction", "timestamp": "...", "data": {"trigger": "quiz_complete", "buddy_message_shown": "..."}}
{"type": "session_complete", "timestamp": "...", "data": {"triggered_by": "student_click"}}
```

### `teaching_process/sessions/{session_id}.teacher.jsonl`

**Writer:** edu-teacher agent ONLY (one JSON per line, append-only)

Line types:
```
{"type": "chat_message", "timestamp": "...", "sender": "teacher", "message": "..."}
{"type": "hint_provided", "timestamp": "...", "data": {"quiz_id": "...", "question_id": "...", "hint": "..."}}
```

### Completion signal file

When session completes, server writes: `teaching_process/sessions/{session_id}.completed`
(Empty file — its existence is the signal)

---

## 5. Evaluation Report — `teaching_process/evaluations/{eval_id}.json`

**Writers:** edu-evaluator
**Readers:** edu-planner, orchestrator, dashboard

| Field | Type | Description |
|-------|------|-------------|
| eval_id | string | Unique eval ID |
| session_id | string | Which session |
| chapter_id | string | Which chapter |
| student_id | string | Which student |
| evaluated_at | ISO 8601 | Timestamp |
| methods_used | string[] | quiz_analysis, chat_analysis, assignment_rubric, socratic_dialogue |
| method_selection_reason | string | Why these methods were chosen |
| scores | object | `{quiz_score, understanding_level, engagement_level, confidence_level}` (all 0.0-1.0) |
| overall_score | float | Weighted composite 0.0-1.0 |
| understanding_assessment | string | Free-text analysis |
| strengths | string[] | What student did well |
| weaknesses | string[] | What needs work |
| recommendations | object | `{next_action, difficulty_adjustment, suggested_focus, suggested_approach, ready_for_next_chapter}` |
| adaptation_suggestions | object[] | `{type, reason, suggested_chapter}` |

### Evaluator Method Selection Matrix

| Available Data | Methods Used |
|---------------|-------------|
| Quiz data + chat data | quiz_analysis + chat_analysis |
| Quiz data only | quiz_analysis + assignment_rubric |
| Chat data only | chat_analysis + socratic_dialogue |
| Neither | socratic_dialogue only |

---

## 6. Research Brief — `teaching_process/research_briefs/{topic_slug}.json`

**Writers:** edu-researcher
**Readers:** edu-planner

| Field | Type | Description |
|-------|------|-------------|
| topic | string | Subject area |
| generated_at | ISO 8601 | Timestamp |
| source_materials | string[] | Filenames of processed materials |
| source_materials_summary | string | What was analyzed |
| concepts | object[] | `{name, difficulty, prerequisites, description}` |
| concept_graph | object | `{nodes: string[], edges: [{from, to}]}` |
| difficulty_range | object | `{min, max}` |
| recommended_starting_point | string | Where to begin |
| total_estimated_chapters | int | Estimated course length |

---

## 7. settings.json — `teaching_process/settings.json`

**Writers:** Orchestrator, edu-setup
**Readers:** All agents

Runtime state tracking. See initial template for all fields.

---

## 8. loop_state.json — `teaching_process/loop_state.json`

**Writers:** Orchestrator only
**Readers:** Orchestrator on startup

Per-step completion tracking for crash recovery. See Resumability Protocol in CLAUDE.md.

---

## 9. materials_index.json — `teaching_process/materials_index.json`

**Writers:** edu-researcher (creates and updates)
**Readers:** edu-planner, edu-critic, edu-creator, edu-evaluator

Master index of all organized learning materials. The researcher processes raw uploads into structured, indexed sections that all agents can reference by ID.

**Schema:**
```json
{
  "status": "not_started|processing|organized|updated",
  "organized_at": "2026-04-01T10:30:00Z",
  "source_files": [
    {
      "id": "src_001",
      "original_filename": "calculus_textbook.pdf",
      "format": "pdf|text|url|image|md",
      "original_path": "teaching_process/materials/calculus_textbook.pdf",
      "processed_path": "teaching_process/materials_markdown/calculus_textbook.md",
      "ocr_used": false,
      "pages": 45,
      "summary": "Introductory calculus textbook covering limits, derivatives, and integrals."
    }
  ],
  "sections": [
    {
      "id": "sec_001",
      "source_id": "src_001",
      "title": "Chapter 1: Limits",
      "page_range": "1-12",
      "concepts": ["limit_definition", "limit_laws", "continuity"],
      "difficulty": 3,
      "content_path": "teaching_process/materials_organized/sec_001_limits.md",
      "key_points": ["Definition of a limit", "One-sided limits", "Squeeze theorem"],
      "has_examples": true,
      "has_exercises": true,
      "has_images": false,
      "source_type": "uploaded|web_supplemental|creator_supplemental"
    }
  ],
  "total_pages": 45,
  "topics_covered": ["limits", "derivatives", "integrals"],
  "difficulty_range": {"min": 2, "max": 7},
  "concept_to_section_map": {
    "limit_definition": ["sec_001"],
    "derivative_rules": ["sec_003", "sec_004"]
  }
}
```

**Key design:** The `concept_to_section_map` lets the planner look up which source sections cover a specific concept. The planner references `section.id` in its plan, and the creator uses `content_path` to read the actual source material.

### Organized materials folder: `teaching_process/materials_organized/`

The researcher writes processed, chunked material here — one markdown file per section. Each file is self-contained with:
```markdown
# Section Title
Source: {original_filename}, pages {page_range}
Concepts: {concept_list}

{extracted and cleaned content}

## Key Points
- ...

## Examples (if present)
- ...

## Exercises (if present)
- ...
```

---

## 9b. Standardized Plan Format — Source References

Chapter plans (`teaching_process/plans/{chapter_id}.json`) must include source references so the creator knows exactly where to draw content from:

```json
{
  "content_outline": [
    {
      "section": "introduction",
      "description": "Visual explanation of limits using a number line",
      "source_refs": ["sec_001"],
      "source_key_points": ["Definition of a limit"],
      "teaching_notes": "Use the textbook's number line example from page 3"
    },
    {
      "section": "explanation",
      "description": "Formal definition and limit laws",
      "source_refs": ["sec_001", "sec_002"],
      "source_key_points": ["Limit laws", "One-sided limits"],
      "teaching_notes": "Simplify the formal definition for this student's level"
    }
  ]
}
```

The `source_refs` array contains section IDs from `materials_index.json`. The creator reads the corresponding `content_path` files to build HTML with accurate source content.

---

## 10. active_agents.json — `teaching_process/active_agents.json`

**Writers:** Orchestrator (before/after every agent invocation)
**Readers:** Orchestrator on startup (to recover lost teammate sessions)

Tracks all active agent/teammate sessions so the orchestrator can recover state if it crashes or loses context.

**Schema:**
```json
{
  "description": "Registry of active agent/teammate sessions.",
  "agents": [
    {
      "agent_name": "edu-teacher",
      "agent_type": "teammate",
      "status": "active|completed|failed",
      "spawned_at": "2026-04-01T14:00:00Z",
      "completed_at": null,
      "arguments": "plan_path=/abs/path session_id=session_ch_002_001 project_root=/abs/path",
      "step": "teach",
      "loop_iteration": 3,
      "chapter_id": "ch_002",
      "session_id": "session_ch_002_001",
      "notes": "Live teaching session in progress"
    }
  ]
}
```

**Update protocol:**
1. **Before spawning**: Append entry with `status: "active"`, `spawned_at`, `arguments`, `step`
2. **After agent completes**: Update entry: `status: "completed"`, `completed_at`
3. **On agent failure**: Update entry: `status: "failed"`, `completed_at`, `notes` with error
4. **On startup**: Read file. If any agent has `status: "active"`, the orchestrator knows a teammate was running when it crashed. Decision:
   - If `agent_type: "teammate"` (edu-teacher): check if session has `.completed` signal file. If yes, proceed to evaluate. If no, the session may still be active or was lost — restart the teacher.
   - If `agent_type: "agent"` (non-teammate): check if output file exists. If yes, mark completed and continue. If no, re-run the agent.
5. **Cleanup**: On each loop iteration start, remove entries with `status: "completed"` from previous iterations to keep the file small.

---

## 11. History Files — `teaching_process/history/`

### raw_data.json (append-only array)

**Writer:** Orchestrator (appends after each EVALUATE phase)

Each entry:
```json
{
  "iteration": 1,
  "timestamp": "2026-04-01T14:35:00Z",
  "chapter_id": "ch_001",
  "chapter_title": "Counting 1 to 10",
  "difficulty": 1,
  "session_id": "session_ch_001_001",
  "duration_minutes": 22,
  "scores": {
    "quiz_score": 0.88,
    "understanding_level": 0.85,
    "engagement_level": 0.90,
    "confidence_level": 0.75,
    "overall_score": 0.84
  },
  "methods_used": ["quiz_analysis", "chat_analysis"],
  "evaluation_summary": "Strong grasp of counting. Ready for addition.",
  "strengths": ["number_recognition"],
  "weaknesses": ["reverse_counting"],
  "adaptation_action": "advance_to_next",
  "next_chapter": "ch_002",
  "buddy_xp_earned": 15,
  "buddy_level": 2,
  "student_level_before": 0.50,
  "student_level_after": 0.65
}
```

### progress_summary.json (regenerated after each iteration)

**Writer:** Orchestrator

Aggregated from raw_data.json for dashboard consumption. See initial template for fields.
