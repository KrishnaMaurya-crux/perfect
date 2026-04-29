/**
 * PDF Summary Tool — Public API
 *
 * This barrel file exports the complete pipeline for the PDF Summary feature:
 *
 *   1. `extractTextFromPDF(file)`  — Extract raw text from a PDF
 *   2. `validatePDFFile(file)`      — Check file validity before processing
 *   3. `cleanText(raw)`             — Normalize extracted text
 *   4. `generateSummary(cleaned)`   — Produce bullet-point summary
 *   5. `generateSummaryWithAI(text)`— AI-powered summary (future Gemini)
 *   6. `summarizePDF(file)`         — One-call end-to-end pipeline
 *
 * Usage (in AIToolPage or any component):
 * ```ts
 *   import { summarizePDF } from '@/lib/pdf-summary-tool';
 *
 *   const result = await summarizePDF(file);
 *   // result.bulletPoints → ["...", "...", ...]
 * ```
 */

export {
  extractTextFromPDF,
  validatePDFFile,
  type ExtractionResult,
} from "./extractor";

export {
  cleanText,
  type CleanedText,
} from "./text-cleaner";

export {
  generateSummary,
  generateSummaryWithAI,
  type SummaryResult,
} from "./summary-engine";

// Re-export for convenience
import { extractTextFromPDF, validatePDFFile } from "./extractor";
import { cleanText } from "./text-cleaner";
import { generateSummary } from "./summary-engine";

/**
 * End-to-end pipeline: file → cleaned text → bullet-point summary.
 *
 * @param file - The user-uploaded PDF file.
 * @param options - Optional overrides for bullet count range.
 * @returns A `SummaryResult` with title, bullet points, and metadata.
 *
 * @throws {Error} If the file is invalid or text extraction fails.
 */
export async function summarizePDF(
  file: File,
  options?: { minBullets?: number; maxBullets?: number }
) {
  // 1. Validate
  const validationError = validatePDFFile(file, 50);
  if (validationError) {
    throw new Error(validationError);
  }

  // 2. Extract
  const extraction = await extractTextFromPDF(file);
  if (!extraction.success || !extraction.text.trim()) {
    throw new Error(extraction.error ?? "Could not extract text from this PDF.");
  }
  if (extraction.text.trim().length < 50) {
    throw new Error(
      "Could not extract enough text from this PDF. Please try a text-based PDF."
    );
  }

  // 3. Clean
  const cleaned = cleanText(extraction.text);

  // 4. Summarize
  const result = generateSummary(cleaned, options);

  return result;
}
