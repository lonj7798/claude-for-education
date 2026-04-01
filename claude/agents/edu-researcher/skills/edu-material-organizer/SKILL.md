---
name: edu-material-organizer
description: Chunk processed markdown files into logical, indexed sections with metadata.
user-invocable: false
allowed-tools: Read, Write, Grep, Glob
---

# Edu Material Organizer

## Purpose
Takes all processed markdown files from `materials_markdown/` and splits them into logical, self-contained sections. Each section receives a unique ID, slug, inferred concept list, difficulty estimate, and key points summary. Produces both the individual section files and the authoritative `materials_index.json` consumed by all downstream skills.

## When to Use
Invoked by edu-researcher after edu-pdf-processor has finished all files. Must run before edu-concept-mapper. Re-run whenever source markdown files have changed or been added.

## Inputs
- `markdown_dir` — absolute path to `teaching_process/materials_markdown/`
- `output_dir` — absolute path to `teaching_process/materials_organized/`
- `project_root` — absolute path to the project root

## Workflow

### Step 1 — Discover Markdown Files
Use Glob to list all `.md` files in `markdown_dir`. Sort alphabetically. If the directory is empty, abort and return `{"status": "error", "reason": "no processed markdown files found"}`.

### Step 2 — Read Each File
Use Read on each discovered file. Track the filename as `source_id` (the basename without `.md`). Keep a running section counter starting at 1.

### Step 3 — Identify Section Boundaries
For each file, determine split points using this priority order:
1. **Heading-based**: split at every `##` (H2) boundary. If only `#` (H1) headings exist and there are multiple, split at each H1.
2. **Topic shift**: if a large block has no headings but content changes subject matter noticeably (e.g., from definitions to formulas to examples), treat the shift as a boundary.
3. **Length cap**: if a candidate section exceeds 2000 words, split further at the nearest paragraph boundary below that limit. Minimum section size is 200 words — merge shorter fragments with the preceding section.

### Step 4 — Assign Metadata to Each Section
For each section, produce:
- `id`: `sec_{NNN}` where NNN is zero-padded to 3 digits (e.g., `sec_001`)
- `slug`: lowercase section title, spaces replaced with underscores, special characters stripped
- `title`: the heading text that opened this section, or a derived label if no heading present
- `source_id`: basename of the source markdown file (no extension)
- `concepts`: list of concept names inferred from the section content (nouns and noun phrases that represent teachable ideas)
- `difficulty`: integer 1–10 estimated from vocabulary complexity, abstraction level, and assumed prerequisite density
- `key_points`: list of 3–5 bullet strings summarizing the section's core claims
- `has_examples`: true if the section contains worked examples or sample problems
- `has_exercises`: true if the section contains practice problems or exercise prompts
- `has_images`: true if the source referenced images or if OCR content was detected

### Step 5 — Write Section Files
Write each section to `{output_dir}/sec_{NNN}_{slug}.md` using this structure:
```
# {Section Title}
Source: {source_id}, pages {page_range_or_N/A}
Concepts: {comma-separated concept list}

{section body content}

## Key Points
- {point 1}
- {point 2}
- {point 3}

## Examples
{examples content, if has_examples is true — omit block otherwise}

## Exercises
{exercises content, if has_exercises is true — omit block otherwise}
```

### Step 6 — Build Concept-to-Section Map
Collect all concepts across all sections. Deduplicate by exact name (case-insensitive). For each unique concept, record the list of `sec_{NNN}` IDs that cover it. This produces `concept_to_section_map`.

### Step 7 — Write materials_index.json
Write to `{project_root}/teaching_process/materials_index.json`:
```json
{
  "status": "organized",
  "organized_at": "{ISO timestamp}",
  "source_files": [
    {"source_id": "...", "original_filename": "...", "section_count": 0}
  ],
  "sections": [
    {
      "id": "sec_001", "slug": "...", "title": "...", "source_id": "...",
      "concepts": [], "difficulty": 5, "key_points": [],
      "has_examples": false, "has_exercises": false, "has_images": false
    }
  ],
  "total_sections": 0,
  "topics_covered": [],
  "difficulty_range": {"min": 1, "max": 10},
  "concept_to_section_map": {"concept_name": ["sec_001"]}
}
```
`topics_covered` is the deduplicated flat list of all concept names across all sections.

## Output
- `{output_dir}/sec_{NNN}_{slug}.md` — one file per section
- `{project_root}/teaching_process/materials_index.json` — full index

## Error Handling
- **File too short to split** (under 200 words total): keep as a single section, assign `sec_{NNN}` normally.
- **No headings found in file**: split by paragraph groups targeting ~500 words each. Derive titles from the first sentence of each group.
- **Duplicate concept names across files**: merge into the same `concept_to_section_map` entry — append both section IDs to the array.
- **output_dir does not exist**: create it with Write before writing any section files.
- **Counter collision** (should not occur, but guard): skip the conflicting ID, log a warning, and increment counter.
