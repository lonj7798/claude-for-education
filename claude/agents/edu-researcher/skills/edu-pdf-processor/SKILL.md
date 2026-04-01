---
name: edu-pdf-processor
description: Extract text from PDF files, images (OCR), URLs, and other formats into clean markdown.
user-invocable: false
allowed-tools: Read, Write, Bash, WebFetch
---

# Edu PDF Processor

## Purpose
Processes a single raw material file into clean markdown. Handles PDF text extraction, image OCR via Claude vision, URL fetching, and HTML content extraction. Outputs a normalized markdown file ready for chunking by edu-material-organizer.

## When to Use
Invoked by edu-researcher for each file in the raw materials directory before organization begins. Run once per file. Re-run if source files are updated or if output markdown is missing or stale.

## Inputs
- `file_path` — absolute path to the source file (PDF, image, .url, HTML, or text)
- `output_dir` — absolute path to `teaching_process/materials_markdown/`
- `project_root` — absolute path to the project root

## Workflow

### Step 1 — Detect Format
Inspect the file extension to classify the input:
- `.pdf` → PDF extraction path
- `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` → image OCR path
- `.url` → URL fetch path
- `.html`, `.htm` → HTML extraction path
- `.txt`, `.md` → plain text path
- Unknown extension → attempt plain text, warn in metadata

### Step 2 — Process by Format

**PDF (`.pdf`)**
Try extraction in order of preference:
1. Run `pdftotext "{file_path}" -` via Bash. Capture stdout.
2. If pdftotext is unavailable, run `python3 -c "import fitz; doc=fitz.open('{file_path}'); [print(p.get_text()) for p in doc]"` via Bash.
3. If both fail, use the Read tool directly — Claude can read PDF content natively.
Post-process extracted text: fix broken line breaks mid-sentence, remove repeated headers and footers, strip page numbers, normalize whitespace to single blank lines between paragraphs. Count pages from extraction output.

**Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`)**
Use the Read tool to view the image (Claude vision is active). Transcribe all visible text verbatim. Convert any mathematical expressions to LaTeX inline fences (`$...$`) or display fences (`$$...$$`). Describe diagrams, charts, and figures as structured text with a `[Figure: ...]` label. Set `ocr_used: true` in returned metadata.

**URLs (`.url` files)**
Read the `.url` file to extract the URL string. Use WebFetch to retrieve the page. Extract the main article body — strip navigation bars, sidebars, advertisements, footers, and cookie banners. Convert remaining content to clean markdown: preserve headings, ordered/unordered lists, code blocks, and paragraph text.

**HTML (`.html`, `.htm`)**
Read the file. Extract content within `<body>`. Convert semantic elements to markdown: `<h1>`–`<h6>` to `#`–`######`, `<ul>`/`<ol>` to list markers, `<pre>`/`<code>` to fenced blocks. Strip all `<script>`, `<style>`, and `<nav>` elements. Output clean markdown only.

**Text / Markdown (`.txt`, `.md`)**
Read the file directly. Normalize spacing: collapse runs of blank lines to a single blank line, ensure headings have a blank line above them, trim trailing whitespace per line.

### Step 3 — Write Output
Write the processed markdown to `{output_dir}/{original_filename_without_extension}.md`. If a file already exists at that path, overwrite it.

### Step 4 — Return Metadata
Return a JSON object:
```json
{
  "original_file": "absolute path",
  "format": "pdf | image | url | html | text",
  "processed_path": "absolute path to output .md",
  "ocr_used": false,
  "pages": null,
  "char_count": 0
}
```
`pages` is an integer for PDFs, `null` for all other formats.

## Output
- `{output_dir}/{name}.md` — clean markdown of the source file
- Metadata JSON returned to the calling agent (not written to disk)

## Error Handling
- **PDF tools unavailable**: Fall through to Read tool fallback silently. Do not abort.
- **Image unreadable or blank**: Return `{"status": "failed", "reason": "unreadable image"}`. Do not write an output file.
- **URL unreachable or returns non-200**: Return `{"status": "failed", "reason": "URL unreachable", "url": "..."}`. Do not write an output file.
- **Empty file (0 bytes or whitespace only)**: Skip without writing output. Log a warning: `"Skipped {file_path}: empty file"`.
- **Unknown format**: Attempt plain text read. If content is binary/garbled, return `{"status": "failed", "reason": "unknown or binary format"}`.
