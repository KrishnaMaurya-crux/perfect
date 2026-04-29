/**
 * PDF Notes Tool — Public API
 *
 * Modular pipeline for converting PDF documents into structured study notes:
 *
 *   1. `extractText(file)`          — Extract raw text from a PDF
 *   2. `validatePDFFile(file)`      — Check file validity before processing
 *   3. `cleanText(raw)`             — Normalize extracted text (preserve line structure)
 *   4. `processSections(cleaned)`   — Detect headings & split into sections
 *   5. `formatNotes(processed)`     — Convert sections to structured notes
 *   6. `generateNotesWithAI(text)`  — AI-powered notes (future Gemini)
 *   7. `generatePDFNotes(file)`     — One-call end-to-end pipeline
 *
 * Usage (in AIToolPage or any component):
 * ```ts
 *   import { generatePDFNotes } from '@/lib/pdf-notes-tool';
 *
 *   const result = await generatePDFNotes(file);
 *   // result.sections → [{ heading: "...", content: ["...", ...] }, ...]
 * ```
 */

export {
  extractText,
  validatePDFFile,
  type ExtractionResult,
} from "./extractor";

export {
  cleanText,
  type CleanedText,
} from "./text-cleaner";

export {
  processSections,
  type RawSection,
  type ProcessedSections,
} from "./section-processor";

export {
  formatNotes,
  generateNotesWithAI,
  type NotesSection,
  type NotesResult,
} from "./notes-formatter";

// Re-export for convenience
import { extractText, validatePDFFile } from "./extractor";
import { cleanText } from "./text-cleaner";
import { processSections } from "./section-processor";
import { formatNotes } from "./notes-formatter";

/**
 * End-to-end pipeline: file → cleaned text → sections → structured notes.
 *
 * @param file - The user-uploaded PDF file.
 * @param options - Optional overrides for bullet count range.
 * @returns A `NotesResult` with title, sections, bullet points, and metadata.
 *
 * @throws {Error} If the file is invalid or text extraction fails.
 */
export async function generatePDFNotes(
  file: File,
  options?: { maxBullets?: number; minBullets?: number }
) {
  // 1. Validate
  const validationError = validatePDFFile(file, 50);
  if (validationError) {
    throw new Error(validationError);
  }

  // 2. Extract
  const extraction = await extractText(file);
  if (!extraction.success || !extraction.text.trim()) {
    throw new Error(
      extraction.error ?? "Could not extract text from this PDF."
    );
  }
  if (extraction.text.trim().length < 50) {
    throw new Error(
      "Could not extract enough text from this PDF. Please try a text-based PDF."
    );
  }

  // 3. Clean (preserving line structure for section detection)
  const cleaned = cleanText(extraction.text);

  // 4. Process into sections
  const processed = processSections(cleaned);

  // 5. Format into notes
  const result = formatNotes(processed, cleaned.wordCount, options);

  return result;
}
