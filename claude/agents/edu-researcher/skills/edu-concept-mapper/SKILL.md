---
name: edu-concept-mapper
description: Build a concept dependency graph with difficulty ratings from organized material sections.
user-invocable: false
allowed-tools: Read, Write, Grep, Glob, WebSearch
---

# Edu Concept Mapper

## Purpose
Reads organized material sections and the student profile to produce the concept graph (nodes + directed prerequisite edges) and research brief. Separated from material processing so it can be re-run independently when the student profile changes but materials have not. The output drives chapter sequencing in edu-planner.

## When to Use
Invoked by edu-researcher after edu-material-organizer completes. Also invoked directly when the student profile is updated and concept difficulty calibration needs to be refreshed without re-processing source files.

## Inputs
- `materials_index_path` — absolute path to `teaching_process/materials_index.json`
- `profile_path` — absolute path to `student_profile.json`
- `project_root` — absolute path to the project root

## Workflow

### Step 1 — Read Materials Index
Read `materials_index.json`. Extract the full `sections` array and `concept_to_section_map`. If the file is missing or `status` is not `"organized"`, abort and return `{"status": "error", "reason": "materials not yet organized"}`.

### Step 2 — Read Student Profile
Read `student_profile.json`. Extract `education_level`, `age_group`, and any declared `prior_knowledge` fields. These calibrate difficulty ratings: a concept rated 7/10 for a general audience may be 4/10 for a graduate student or 9/10 for a middle schooler.

### Step 3 — Deduplicate Concepts
Collect all concept names from `concept_to_section_map`. Normalize to lowercase for deduplication. Preserve the original casing of the first occurrence as the canonical label. Build a working set of unique concept objects.

### Step 4 — Enrich Each Concept
For each unique concept, produce:
- `name`: canonical label (original casing)
- `difficulty`: integer 1–10, calibrated to this student's `education_level` and `age_group`
- `prerequisites`: list of other concept names that logically must be understood first; derive from content proximity in sections and standard domain knowledge
- `description`: 1–2 sentences explaining what this concept is in plain language
- `source_sections`: list of `sec_{NNN}` IDs from `concept_to_section_map` that cover this concept
- `covered_in_materials`: true if `source_sections` is non-empty, false if inferred from domain knowledge only

### Step 5 — Build the Directed Graph
Construct the concept graph:
- `nodes`: one entry per unique concept name
- `edges`: array of `{"from": "prerequisite_concept", "to": "dependent_concept"}` pairs derived from the `prerequisites` fields

**Cycle detection**: perform a depth-first search for cycles. If a cycle is found, identify the edge with the weakest semantic dependency (most debatable prerequisite relationship) and remove it. Record the removed edge in `summary.cycles_broken`.

### Step 6 — Identify Starting Point and Scope
- `recommended_starting_point`: the concept(s) with no unmet prerequisites given the student's declared `prior_knowledge`. If prior_knowledge is empty, use concepts with no prerequisites at all.
- `total_estimated_chapters`: calculate as `ceil(unique_concept_count / 2)`, since chapters typically cover 1–3 concepts. Adjust down if many concepts are closely related (can be co-taught).

### Step 7 — Supplement Thin Material with WebSearch
If any concept has `covered_in_materials: false`, or if fewer than 10 unique concepts were found across all materials, use WebSearch to find supplementary explanations and prerequisite structures for the topic. Incorporate findings into concept descriptions and prerequisite edges. Note supplemented concepts in `summary.web_supplemented`.

### Step 8 — Write Research Brief
Determine `topic_slug` from the project root directory name or the dominant topic inferred from concept names. Write to `{project_root}/teaching_process/research_briefs/{topic_slug}.json`:
```json
{
  "topic_slug": "...",
  "generated_at": "{ISO timestamp}",
  "student_calibration": {"education_level": "...", "age_group": "..."},
  "concept_graph": {
    "nodes": ["concept_name", "..."],
    "edges": [{"from": "...", "to": "..."}]
  },
  "concepts": [
    {
      "name": "...", "difficulty": 5, "prerequisites": [],
      "description": "...", "source_sections": [], "covered_in_materials": true
    }
  ],
  "section_mapping": {"concept_name": ["sec_001"]},
  "recommended_starting_point": ["..."],
  "total_estimated_chapters": 0,
  "summary": {
    "total_concepts": 0,
    "cycles_broken": [],
    "web_supplemented": []
  }
}
```
Create the `research_briefs/` directory if it does not exist.

## Output
- `{project_root}/teaching_process/research_briefs/{topic_slug}.json` — full concept graph and research brief

## Error Handling
- **No materials organized**: proceed using topic name + WebSearch + internal domain knowledge. Set all concepts to `covered_in_materials: false`.
- **Cycle detected in graph**: break the weakest edge (least semantically critical prerequisite). Record in `summary.cycles_broken`. Never leave a cycle in the output graph.
- **Fewer than 10 concepts**: use WebSearch to discover sub-concepts and related foundational ideas. Expand until at least 10 nodes exist or the topic is genuinely narrow.
- **More than 50 concepts**: merge closely related concepts (e.g., synonyms, micro-variations of the same idea) into a single node. Aim for a graph of 15–40 nodes for a teachable scope.
- **Student profile missing**: use generic difficulty calibration (assume intermediate level). Log a warning in `summary`.
