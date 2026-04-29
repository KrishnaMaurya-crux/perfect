"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  Layers,
  RotateCw,
  Droplets,
  PenTool,
  Lock,
  Unlock,
  Scissors,
  Hash,
  Shield,
  Image as ImageIcon,
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  List,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ========================
// Types
// ========================

interface PreviewPage {
  pageNum: number;
  dataUrl: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

interface LivePreviewProps {
  toolId: string;
  files: File[];
  optionValues: Record<string, string | number | boolean>;
  compareFileA?: File | null;
  compareFileB?: File | null;
}

// ========================
// PDF Page Renderer
// ========================

let pdfJsModule: typeof import("pdfjs-dist") | null = null;

async function getPdfjs() {
  if (pdfJsModule) return pdfJsModule;
  pdfJsModule = await import("pdfjs-dist");
  pdfJsModule.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfJsModule;
}

function parsePageRange(input: string, totalPages: number): number[] {
  if (!input || input.trim() === "") {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const indices = new Set<number>();
  const parts = input.split(",").map((s) => s.trim());
  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-").map((s) => s.trim());
      const start = Math.max(1, parseInt(startStr) || 1);
      const end = Math.min(totalPages, parseInt(endStr) || totalPages);
      for (let i = start; i <= end; i++) {
        indices.add(i - 1);
      }
    } else {
      const num = parseInt(part);
      if (num >= 1 && num <= totalPages) {
        indices.add(num - 1);
      }
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}

// Render a single file's pages to thumbnails
async function renderPdfPages(
  file: File,
  maxPages = 50,
  scale = 0.4
): Promise<PreviewPage[]> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pageCount = Math.min(pdf.getPageCount(), maxPages);
  const pages: PreviewPage[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = await pdf.getPage(i + 1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({
      pageNum: i + 1,
      dataUrl: canvas.toDataURL("image/jpeg", 0.7),
      width: viewport.width,
      height: viewport.height,
      originalWidth: page.getViewport({ scale: 1 }).width,
      originalHeight: page.getViewport({ scale: 1 }).height,
    });
  }
  return pages;
}

// Render image file to thumbnail
async function renderImageThumbnail(
  file: File,
  scale = 0.4
): Promise<PreviewPage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({
        pageNum: 1,
        dataUrl: canvas.toDataURL("image/jpeg", 0.7),
        width: canvas.width,
        height: canvas.height,
        originalWidth: img.width,
        originalHeight: img.height,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

// ========================
// Split Preview Groups
// ========================

interface SplitGroup {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  pages: number[];
}

const SPLIT_COLORS = [
  { color: "text-rose-500", bgColor: "bg-rose-50 dark:bg-rose-950/20", borderColor: "border-rose-300 dark:border-rose-700" },
  { color: "text-sky-500", bgColor: "bg-sky-50 dark:bg-sky-950/20", borderColor: "border-sky-300 dark:border-sky-700" },
  { color: "text-emerald-500", bgColor: "bg-emerald-50 dark:bg-emerald-950/20", borderColor: "border-emerald-300 dark:border-emerald-700" },
  { color: "text-amber-500", bgColor: "bg-amber-50 dark:bg-amber-950/20", borderColor: "border-amber-300 dark:border-amber-700" },
  { color: "text-violet-500", bgColor: "bg-violet-50 dark:bg-violet-950/20", borderColor: "border-violet-300 dark:border-violet-700" },
  { color: "text-teal-500", bgColor: "bg-teal-50 dark:bg-teal-950/20", borderColor: "border-teal-300 dark:border-teal-700" },
  { color: "text-pink-500", bgColor: "bg-pink-50 dark:bg-pink-950/20", borderColor: "border-pink-300 dark:border-pink-700" },
  { color: "text-orange-500", bgColor: "bg-orange-50 dark:bg-orange-950/20", borderColor: "border-orange-300 dark:border-orange-700" },
];

function getSplitGroups(
  totalPages: number,
  options: Record<string, string | number | boolean>
): SplitGroup[] {
  const mode = String(options["split-mode"] || "all");
  const groups: SplitGroup[] = [];

  if (mode === "all") {
    for (let i = 0; i < totalPages; i++) {
      const ci = i % SPLIT_COLORS.length;
      groups.push({
        label: `Page ${i + 1}`,
        ...SPLIT_COLORS[ci],
        pages: [i + 1],
      });
    }
  } else if (mode === "ranges") {
    const rangeInput = String(options["page-ranges"] || "");
    const ranges = rangeInput.split(",").map((s) => s.trim()).filter(Boolean);
    ranges.forEach((range, idx) => {
      const indices = parsePageRange(range, totalPages);
      const ci = idx % SPLIT_COLORS.length;
      groups.push({
        label: `Part ${idx + 1}: ${range}`,
        ...SPLIT_COLORS[ci],
        pages: indices.map((i) => i + 1),
      });
    });
  } else if (mode === "extract") {
    const rangeInput = String(options["page-ranges"] || "1");
    const indices = parsePageRange(rangeInput, totalPages);
    groups.push({
      label: `Extracted: ${rangeInput}`,
      ...SPLIT_COLORS[0],
      pages: indices.map((i) => i + 1),
    });
  } else if (mode === "interval") {
    const interval = Number(options["interval"] || 5);
    for (let start = 0; start < totalPages; start += interval) {
      const end = Math.min(start + interval, totalPages);
      const ci = groups.length % SPLIT_COLORS.length;
      groups.push({
        label: `Pages ${start + 1}-${end}`,
        ...SPLIT_COLORS[ci],
        pages: Array.from({ length: end - start }, (_, i) => start + i + 1),
      });
    }
  }
  return groups;
}

// ========================
// Page Number Text Preview
// ========================

function getPageNumberText(
  pageNum: number,
  totalPages: number,
  options: Record<string, string | number | boolean>
): string {
  const format = String(options["format"] || "numeric");
  const startNumber = Number(options["start-number"] || 1);
  const num = startNumber + (pageNum - 1);

  switch (format) {
    case "page-prefix":
      return `Page ${num}`;
    case "dashed":
      return `- ${num} -`;
    case "of-total":
      return `Page ${num} of ${totalPages}`;
    case "roman-lower":
      return toRoman(num).toLowerCase();
    case "roman-upper":
      return toRoman(num);
    case "alpha-lower":
      return toAlpha(num).toLowerCase();
    case "alpha-upper":
      return toAlpha(num);
    default:
      return String(num);
  }
}

function toRoman(num: number): string {
  const roman: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let result = "";
  for (const [value, symbol] of roman) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }
  return result;
}

function toAlpha(num: number): string {
  let result = "";
  num -= 1;
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  }
  return result;
}

// ========================
// Main Component
// ========================

export default function LivePreview({
  toolId,
  files,
  optionValues,
  compareFileA,
  compareFileB,
}: LivePreviewProps) {
  const [pages, setPages] = useState<PreviewPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPdf = files.length > 0 && files[0]?.type === "application/pdf";
  const isImage =
    files.length > 0 &&
    (files[0]?.type?.startsWith("image/") ||
      files[0]?.name?.match(/\.(jpe?g|png|gif|webp|bmp)$/i));

  // Render pages when files change
  useEffect(() => {
    let cancelled = false;

    async function render() {
      setLoading(true);
      setError(null);
      setPages([]);
      setCurrentPage(0);

      try {
        if (files.length === 0) {
          setLoading(false);
          return;
        }

        if (isPdf && files[0]) {
          const rendered = await renderPdfPages(files[0], 50, 0.5);
          if (!cancelled) {
            setPages(rendered);
            setLoading(false);
          }
        } else if (isImage) {
          // For image-to-pdf tools, render all uploaded images
          const allPages: PreviewPage[] = [];
          for (const file of files.slice(0, 20)) {
            try {
              const thumb = await renderImageThumbnail(file, 0.4);
              allPages.push(thumb);
            } catch {
              // skip failed
            }
          }
          if (!cancelled) {
            setPages(allPages);
            setLoading(false);
          }
        } else {
          // For non-PDF/non-image files, show placeholder
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render preview");
          setLoading(false);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [files, isPdf, isImage]);

  const totalPages = pages.length;

  // Get rotation for a page
  const getRotation = useCallback(
    (pageNum: number) => {
      if (toolId !== "rotate-pdf") return 0;
      const angle = Number(optionValues["rotation"] || 90);
      const applyTo = String(optionValues["apply-to"] || "all");
      const pageRange = String(optionValues["page-range"] || "");
      const indices = pageRange ? parsePageRange(pageRange, totalPages) : [];

      switch (applyTo) {
        case "all":
          return angle;
        case "even":
          return pageNum % 2 === 0 ? angle : 0;
        case "odd":
          return pageNum % 2 === 1 ? angle : 0;
        case "specific":
          return indices.includes(pageNum - 1) ? angle : 0;
        default:
          return 0;
      }
    },
    [toolId, optionValues, totalPages]
  );

  // Get page number position class
  const getPageNumberStyle = useCallback(
    (pageNum: number) => {
      if (toolId !== "page-numbers") return null;
      const position = String(optionValues["position"] || "bottom-center");
      const text = getPageNumberText(pageNum, totalPages, optionValues);
      const fontSize = Number(optionValues["font-size"] || 12);
      return { position, text, fontSize };
    },
    [toolId, optionValues, totalPages]
  );

  // Split groups for split-pdf
  const splitGroups = useMemo(() => {
    if (toolId !== "split-pdf") return [];
    return getSplitGroups(totalPages, optionValues);
  }, [toolId, totalPages, optionValues]);

  // Watermark overlay style
  const watermarkStyle = useMemo(() => {
    if (toolId !== "watermark-pdf") return null;
    const text = String(optionValues["text"] || "");
    const opacity = Number(optionValues["opacity"] || 30) / 100;
    const rotation = Number(optionValues["rotation"] || -45);
    const fontSize = Math.min(Number(optionValues["font-size"] || 48), 36);
    const color = String(optionValues["color"] || "gray");
    const colorMap: Record<string, string> = {
      gray: "rgba(128,128,128,", red: "rgba(200,50,50,", blue: "rgba(50,80,200,",
      green: "rgba(50,150,50,", black: "rgba(0,0,0,", custom: "rgba(50,50,50,",
    };
    return { text, opacity, rotation, fontSize, rgba: colorMap[color] || colorMap.gray };
  }, [toolId, optionValues]);

  // Sign style
  const signStyle = useMemo(() => {
    if (toolId !== "sign-pdf") return null;
    const name = String(optionValues["signer-name"] || "");
    const position = String(optionValues["position"] || "bottom-right");
    const page = Number(optionValues["page"] || 1);
    return { name, position, page };
  }, [toolId, optionValues]);

  // Organize mode
  const organizeMode = useMemo(() => {
    if (toolId !== "organize-pdf") return null;
    const mode = String(optionValues["mode"] || "reorder");
    const pageRange = String(optionValues["page-range"] || "");
    const blankPos = Number(optionValues["blank-position"] || 0);
    return { mode, selectedPages: parsePageRange(pageRange, totalPages), blankPos };
  }, [toolId, optionValues, totalPages]);

  // Compress info
  const compressInfo = useMemo(() => {
    if (toolId !== "compress-pdf") return null;
    const level = String(optionValues["compression-level"] || "medium");
    const dpi = String(optionValues["dpi"] || "150");
    const colorMode = String(optionValues["color-mode"] || "color");
    const levelMap: Record<string, { label: string; reduction: string; quality: string; dpi: number }> = {
      low: { label: "Low", reduction: "~15%", quality: "Excellent", dpi: 200 },
      medium: { label: "Medium", reduction: "~40%", quality: "Good", dpi: 150 },
      high: { label: "High", reduction: "~65%", quality: "Fair", dpi: 120 },
      extreme: { label: "Extreme", reduction: "~80%", quality: "Low", dpi: 72 },
    };
    const levelInfo = levelMap[level] || levelMap.medium;
    const effectiveDpi = Math.min(levelInfo.dpi, Number(dpi));
    const colorLabel = colorMode === "grayscale" ? "Grayscale" : colorMode === "bw" ? "B&W" : "Full Color";
    return { ...levelInfo, effectiveDpi, colorLabel };
  }, [toolId, optionValues]);

  // No preview for certain tools
  const noPreviewTools = ["repair-pdf", "unlock-pdf", "protect-pdf", "pdf-to-pdfa", "compare-pdf"];
  const infoOnlyTools = ["repair-pdf", "unlock-pdf", "protect-pdf", "pdf-to-pdfa"];

  // Don't render if no files or no pages
  if (files.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-8"
    >
      {/* Preview Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Live Preview</h3>
          {totalPages > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalPages} {totalPages === 1 ? "page" : "pages"}
            </Badge>
          )}
        </div>
        {totalPages > 1 && !noPreviewTools.includes(toolId) && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Preview Container */}
      <div
        ref={containerRef}
        className="rounded-xl border bg-card overflow-hidden"
      >
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 rounded-full border-2 border-muted border-t-primary mb-3"
            />
            <p className="text-sm text-muted-foreground">Rendering preview...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Preview unavailable — your file will still process correctly
            </p>
          </div>
        )}

        {/* PDF Page Thumbnails */}
        {!loading && !error && pages.length > 0 && !noPreviewTools.includes(toolId) && (
          <>
            {/* Tool-specific info bar */}
            {toolId === "compress-pdf" && compressInfo && (
              <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-4 flex-wrap">
                <span className="text-xs font-medium">Compression:</span>
                <Badge variant="outline" className="text-xs">{compressInfo.label}</Badge>
                <span className="text-xs text-muted-foreground">
                  Est. reduction: <strong className="text-foreground">{compressInfo.reduction}</strong>
                </span>
                <span className="text-xs text-muted-foreground">
                  Quality: <strong className="text-foreground">{compressInfo.quality}</strong>
                </span>
                <span className="text-xs text-muted-foreground">
                  DPI: <strong className="text-foreground">{compressInfo.effectiveDpi}</strong>
                </span>
                <span className="text-xs text-muted-foreground">
                  Color: <strong className="text-foreground">{compressInfo.colorLabel}</strong>
                </span>
              </div>
            )}

            {toolId === "merge-pdf" && (
              <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-4">
                <span className="text-xs font-medium">{files.length} file(s) to merge</span>
                <span className="text-xs text-muted-foreground">
                  Total pages: <strong>{totalPages}</strong>
                </span>
                <span className="text-xs text-muted-foreground">
                  Mode: <strong>{String(optionValues["merge-mode"] || "sequential")}</strong>
                </span>
              </div>
            )}

            {/* Split groups header */}
            {toolId === "split-pdf" && splitGroups.length > 0 && (
              <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium">Split into {splitGroups.length} file(s):</span>
                {splitGroups.map((g, i) => (
                  <Badge key={i} variant="outline" className={`text-xs ${g.color}`}>
                    {g.label}
                  </Badge>
                ))}
              </div>
            )}

            {/* Page Grid / List */}
            <div
              className={`p-4 ${
                viewMode === "grid"
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
                  : "flex flex-col gap-3 max-h-[400px] overflow-y-auto"
              }`}
            >
              {pages.map((page, idx) => {
                const rotation = getRotation(page.pageNum);
                const pageNumStyle = getPageNumberStyle(page.pageNum);
                const isSplitHighlighted = toolId === "split-pdf";
                const splitGroup = isSplitHighlighted
                  ? splitGroups.find((g) => g.pages.includes(page.pageNum))
                  : null;

                const isOrganizeSelected =
                  toolId === "organize-pdf" &&
                  organizeMode?.mode !== "reorder" &&
                  organizeMode.selectedPages.includes(idx);

                return (
                  <motion.div
                    key={page.pageNum}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`relative group rounded-lg overflow-hidden border bg-white dark:bg-zinc-900 transition-all hover:shadow-md ${
                      splitGroup
                        ? `${splitGroup.borderColor} ${splitGroup.bgColor} border-2`
                        : "border-border"
                    } ${isOrganizeSelected ? "border-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20" : ""}`}
                    style={{
                      ...(viewMode === "list" && {
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                      }),
                    }}
                  >
                    {/* Page thumbnail wrapper */}
                    <div
                      className={`relative overflow-hidden ${
                        viewMode === "grid" ? "aspect-[3/4]" : "w-24 h-32 flex-shrink-0"
                      }`}
                    >
                      {/* PDF page image */}
                      <img
                        src={page.dataUrl}
                        alt={`Page ${page.pageNum}`}
                        className="w-full h-full object-contain"
                        style={{
                          transform: rotation ? `rotate(${rotation}deg)` : undefined,
                          transition: "transform 0.3s ease",
                        }}
                      />

                      {/* Watermark overlay */}
                      {watermarkStyle && watermarkStyle.text && (
                        <div
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                          style={{ opacity: watermarkStyle.opacity }}
                        >
                          <span
                            className="font-bold whitespace-nowrap select-none"
                            style={{
                              fontSize: `${watermarkStyle.fontSize}px`,
                              color: `${watermarkStyle.rgba}${watermarkStyle.opacity})`,
                              transform: `rotate(${watermarkStyle.rotation}deg)`,
                              textShadow: "1px 1px 2px rgba(255,255,255,0.5)",
                            }}
                          >
                            {watermarkStyle.text}
                          </span>
                        </div>
                      )}

                      {/* Signature overlay */}
                      {signStyle &&
                        signStyle.name &&
                        signStyle.page === page.pageNum && (
                          <div
                            className={`absolute inset-0 flex flex-col items-center justify-end pb-4 px-4 pointer-events-none`}
                          >
                            <div
                              className={`flex flex-col items-center ${
                                signStyle.position.includes("top")
                                  ? "absolute top-4"
                                  : ""
                              } ${
                                signStyle.position.includes("left")
                                  ? "absolute left-2"
                                  : ""
                              } ${
                                signStyle.position.includes("right")
                                  ? "absolute right-2"
                                  : ""
                              } ${
                                signStyle.position === "bottom-center" ||
                                signStyle.position === "top-center"
                                  ? "left-1/2 -translate-x-1/2"
                                  : ""
                              }`}
                            >
                              <span className="text-xs italic text-blue-700 dark:text-blue-300">
                                {signStyle.name}
                              </span>
                              <div className="w-20 h-px bg-blue-700/60 dark:bg-blue-300/60 mt-0.5" />
                              <span className="text-[7px] text-gray-500 mt-0.5">
                                Digital Signature
                              </span>
                            </div>
                          </div>
                        )}

                      {/* Page number overlay */}
                      {pageNumStyle && (
                        <div
                          className="absolute inset-0 flex pointer-events-none select-none"
                          style={{
                            alignItems:
                              pageNumStyle.position.includes("bottom")
                                ? "flex-end"
                                : "flex-start",
                            justifyContent: pageNumStyle.position.includes("center")
                              ? "center"
                              : pageNumStyle.position.includes("right")
                              ? "flex-end"
                              : "flex-start",
                            padding: "8px 12px",
                          }}
                        >
                          <span
                            className="text-gray-500 dark:text-gray-400 font-medium bg-white/80 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded text-center"
                            style={{ fontSize: `${Math.min(pageNumStyle.fontSize, 14)}px` }}
                          >
                            {pageNumStyle.text}
                          </span>
                        </div>
                      )}

                      {/* Organize: blank page indicator */}
                      {toolId === "organize-pdf" &&
                        organizeMode?.mode === "insert" &&
                        organizeMode.blankPos === page.pageNum && (
                          <div className="absolute inset-0 border-2 border-dashed border-violet-400 bg-violet-50/40 dark:bg-violet-950/30 flex items-center justify-center">
                            <span className="text-xs text-violet-500 font-medium bg-white/90 dark:bg-zinc-900/90 px-2 py-1 rounded">
                              + Blank
                            </span>
                          </div>
                        )}

                      {/* Page number badge */}
                      <div className="absolute top-1.5 left-1.5">
                        <span className="text-[10px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">
                          {page.pageNum}
                        </span>
                      </div>

                      {/* Rotate indicator */}
                      {rotation > 0 && (
                        <div className="absolute top-1.5 right-1.5">
                          <span className="text-[10px] font-bold bg-primary/80 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <RotateCw className="w-2.5 h-2.5" />
                            {rotation}°
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Page info (list mode) */}
                    {viewMode === "list" && (
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">Page {page.pageNum}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {Math.round(page.originalWidth)} × {Math.round(page.originalHeight)} pt
                          </span>
                        </div>
                        {splitGroup && (
                          <Badge variant="secondary" className={`text-[10px] mt-1 ${splitGroup.color}`}>
                            {splitGroup.label}
                          </Badge>
                        )}
                        {isOrganizeSelected && (
                          <Badge variant="secondary" className="text-[10px] mt-1 text-amber-600">
                            {organizeMode?.mode === "delete"
                              ? "Will be deleted"
                              : organizeMode?.mode === "extract"
                              ? "Will be extracted"
                              : "Selected"}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Grid mode info */}
                    {viewMode === "grid" && (
                      <div className="px-2 py-1.5 border-t border-border/50">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            Page {page.pageNum}
                          </span>
                          {splitGroup && (
                            <span className={`text-[9px] ${splitGroup.color}`}>
                              {splitGroup.label}
                            </span>
                          )}
                          {isOrganizeSelected && (
                            <span className="text-[9px] text-amber-600 font-medium">Selected</span>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Page navigation for single-page view tools */}
            {totalPages > 1 && toolId === "sign-pdf" && (
              <div className="px-4 py-3 border-t flex items-center justify-center gap-4">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="p-1.5 rounded-md border hover:bg-accent disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="p-1.5 rounded-md border hover:bg-accent disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Info-only preview for non-renderable tools */}
        {!loading && !error && infoOnlyTools.includes(toolId) && (
          <div className="p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              {toolId === "repair-pdf" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Repair Preview</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalPages > 0
                        ? `${totalPages} pages detected. The PDF will be analyzed and repaired.`
                        : "Upload a PDF to see the repair preview."}
                    </p>
                  </div>
                  {totalPages > 0 && (
                    <div className="grid grid-cols-3 gap-4 mt-2 w-full max-w-sm">
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <p className="text-lg font-bold">{totalPages}</p>
                        <p className="text-[10px] text-muted-foreground">Pages</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <p className="text-lg font-bold">{formatSize(files[0]?.size)}</p>
                        <p className="text-[10px] text-muted-foreground">Size</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <p className="text-lg font-bold">
                          {files[0]?.name?.split(".").pop()?.toUpperCase()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Format</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {toolId === "protect-pdf" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Protection Preview</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalPages > 0
                        ? `${totalPages} pages will be encrypted with ${String(optionValues["encryption"] || "AES-128").toUpperCase()}.`
                        : "Upload a PDF and set a password."}
                    </p>
                  </div>
                  {String(optionValues["password"]) && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="outline" className="text-xs gap-1">
                        <Lock className="w-3 h-3" />
                        {String(optionValues["encryption"] || "AES-128").toUpperCase()}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${optionValues["allow-print"] ? "text-emerald-500" : "text-red-500"}`}
                      >
                        Print: {optionValues["allow-print"] ? "Yes" : "No"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${optionValues["allow-copy"] ? "text-emerald-500" : "text-red-500"}`}
                      >
                        Copy: {optionValues["allow-copy"] ? "Yes" : "No"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${optionValues["allow-edit"] ? "text-emerald-500" : "text-red-500"}`}
                      >
                        Edit: {optionValues["allow-edit"] ? "Yes" : "No"}
                      </Badge>
                    </div>
                  )}
                </>
              )}

              {toolId === "unlock-pdf" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center">
                    <Unlock className="w-6 h-6 text-sky-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Unlock Preview</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalPages > 0
                        ? `${totalPages} pages will be decrypted and restrictions removed.`
                        : "Upload a locked PDF and enter the password."}
                    </p>
                  </div>
                </>
              )}

              {toolId === "pdf-to-pdfa" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">PDF/A Conversion Preview</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalPages > 0
                        ? `${totalPages} pages will be converted to PDF/A-${String(optionValues["compliance"] || "2b")} format.`
                        : "Upload a PDF to preview the conversion."}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    PDF/A-{String(optionValues["compliance"] || "2b")}
                  </Badge>
                </>
              )}
            </div>
          </div>
        )}

        {/* Compare PDF side-by-side */}
        {!loading && toolId === "compare-pdf" && (
          <ComparePreview compareFileA={compareFileA} compareFileB={compareFileB} />
        )}

        {/* No pages rendered placeholder */}
        {!loading && !error && pages.length === 0 && !infoOnlyTools.includes(toolId) && !noPreviewTools.includes(toolId) && (
          <div className="p-6 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {isImage
                ? `${files.length} image(s) ready for conversion`
                : "File preview not available for this file type"}
            </p>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <p className="text-[11px] text-muted-foreground mt-2 text-center">
        Preview updates in real-time as you change settings above
      </p>
    </motion.div>
  );
}

// ========================
// Compare Preview (Side-by-side)
// ========================

function ComparePreview({
  compareFileA,
  compareFileB,
}: {
  compareFileA?: File | null;
  compareFileB?: File | null;
}) {
  const [pagesA, setPagesA] = useState<PreviewPage[]>([]);
  const [pagesB, setPagesB] = useState<PreviewPage[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (compareFileA) {
        try {
          const p = await renderPdfPages(compareFileA, 5, 0.4);
          if (!cancelled) setPagesA(p);
        } catch { /* skip */ }
      }
      if (compareFileB) {
        try {
          const p = await renderPdfPages(compareFileB, 5, 0.4);
          if (!cancelled) setPagesB(p);
        } catch { /* skip */ }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [compareFileA, compareFileB]);

  if (!compareFileA && !compareFileB) {
    return (
      <div className="p-6 text-center">
        <GitCompareIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Upload two PDFs to see side-by-side comparison
        </p>
      </div>
    );
  }

  const maxPages = Math.max(pagesA.length, pagesB.length);

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-4">
        {/* File A */}
        <div>
          <p className="text-xs font-medium text-center mb-2 text-blue-600 dark:text-blue-400">
            Original (File A)
            {compareFileA && (
              <span className="ml-1 text-muted-foreground font-normal">
                — {pagesA.length} pages
              </span>
            )}
          </p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {pagesA.length === 0 && compareFileA && (
              <p className="text-xs text-muted-foreground text-center py-4">Rendering...</p>
            )}
            {pagesA.map((page) => (
              <div key={page.pageNum} className="rounded-lg border overflow-hidden bg-white dark:bg-zinc-900">
                <img src={page.dataUrl} alt={`A: Page ${page.pageNum}`} className="w-full h-auto" />
                <div className="px-2 py-1 border-t">
                  <span className="text-[10px] text-muted-foreground">Page {page.pageNum}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* File B */}
        <div>
          <p className="text-xs font-medium text-center mb-2 text-emerald-600 dark:text-emerald-400">
            Modified (File B)
            {compareFileB && (
              <span className="ml-1 text-muted-foreground font-normal">
                — {pagesB.length} pages
              </span>
            )}
          </p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {pagesB.length === 0 && compareFileB && (
              <p className="text-xs text-muted-foreground text-center py-4">Rendering...</p>
            )}
            {pagesB.map((page) => (
              <div key={page.pageNum} className="rounded-lg border overflow-hidden bg-white dark:bg-zinc-900">
                <img src={page.dataUrl} alt={`B: Page ${page.pageNum}`} className="w-full h-auto" />
                <div className="px-2 py-1 border-t">
                  <span className="text-[10px] text-muted-foreground">Page {page.pageNum}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Differences indicator */}
      {maxPages > 0 && (
        <div className="mt-3 pt-3 border-t text-center">
          <p className="text-xs text-muted-foreground">
            {pagesA.length !== pagesB.length && (
              <span className="text-amber-500 font-medium">
                Page count differs: {pagesA.length} vs {pagesB.length}.{" "}
              </span>
            )}
            {compareFileA && compareFileB && compareFileA.size !== compareFileB.size && (
              <span className="text-amber-500 font-medium">
                File size differs: {formatSize(compareFileA.size)} vs {formatSize(compareFileB.size)}.{" "}
              </span>
            )}
            {pagesA.length === pagesB.length &&
              compareFileA &&
              compareFileB &&
              compareFileA.size === compareFileB.size && (
                <span className="text-emerald-500 font-medium">
                  Same page count and file size
                </span>
              )}
          </p>
        </div>
      )}
    </div>
  );
}

// ========================
// Helper Components
// ========================

function GitCompareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
  );
}

function formatSize(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
