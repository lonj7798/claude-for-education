---
name: edu-material-reader
description: Read and resolve organized source materials from materials_index.json by concept or section ID.
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# Material Reader

## Purpose

Reads organized source materials and returns structured content for a given set of concepts or section IDs. Used by the planner when designing chapters and by the critic when validating source alignment.

Abstracts away the materials_index.json lookup and file reading so the planner can just say "give me the content for these concepts" without managing file paths.

## When to Use

- Planner needs to know what source content exists for a concept
- Planner wants to read specific organized sections to inform chapter design
- Critic wants to verify a plan's source_refs are valid

## Inputs

One of:
- `concepts={comma-separated concept names}` — resolve via concept_to_section_map
- `sections={comma-separated section IDs}` — direct section lookup
- `all=true` — return the full materials_index summary (no content, just metadata)

Plus: `project_root={abs_path}`

## Workflow

### Step 1 — Read materials_index.json

Read `teaching_process/materials_index.json`. If status is not "organized", return: `{"status": "not_organized", "message": "Materials not yet processed by edu-researcher."}`.

### Step 2 — Resolve requested content

**If `concepts` provided:**
1. For each concept, look up `concept_to_section_map[concept]` → array of section IDs
2. For each section ID, find the section entry in `sections[]`
3. Read the content file at `section.content_path`. If `content_path` is not present, construct the path as `teaching_process/materials_organized/sec_{NNN}_{slug}.md` using the section's `id` and `slug` fields.
4. Return structured result per concept

**If `sections` provided:**
1. For each section ID, find the section entry in `sections[]`
2. Read the content file at `section.content_path`. If `content_path` is not present, construct the path as `teaching_process/materials_organized/sec_{NNN}_{slug}.md` using the section's `id` and `slug` fields.
3. Return structured result per section

**If `all` provided:**
1. Return summary: source_files count, sections count, topics_covered, difficulty_range, concept_to_section_map keys

### Step 3 — Return structured result

For each resolved section, return:
```json
{
  "section_id": "sec_001",
  "title": "Chapter 1: Limits",
  "source_file": "calculus_textbook.pdf",
  "page_range": "1-12",
  "difficulty": 3,
  "key_points": ["Definition of a limit", "One-sided limits"],
  "has_examples": true,
  "has_exercises": true,
  "content_preview": "First 500 chars of the organized section...",
  "full_content_path": "teaching_process/materials_organized/sec_001_limits.md"
}
```

## Output

Returns structured JSON with resolved material content. Does not write any files.

## Error Handling

- Concept not found in map → return `{"concept": "X", "found": false, "note": "No source material covers this concept"}`
- Section file missing → return the metadata but note `"content_available": false`
- Index not organized → return status message
