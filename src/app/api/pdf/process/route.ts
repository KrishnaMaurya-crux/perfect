import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, unlink } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function runQpdf(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("qpdf", args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve();
      }
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const tool = formData.get("tool") as string;
    const files = formData.getAll("files") as File[];
    const optionsRaw = formData.get("options") as string;
    const options = optionsRaw ? JSON.parse(optionsRaw) : {};

    if (!tool) {
      return NextResponse.json({ error: "Tool is required" }, { status: 400 });
    }

    if (tool === "protect-pdf") {
      return handleProtectPDF(files[0], options);
    }

    if (tool === "unlock-pdf") {
      return handleUnlockPDF(files[0], options);
    }

    return NextResponse.json({ error: `Unknown server tool: ${tool}` }, { status: 400 });
  } catch (error) {
    console.error("PDF processing error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "An error occurred" },
      { status: 500 }
    );
  }
}

async function handleProtectPDF(file: File, options: Record<string, string | number | boolean>) {
  const password = String(options["password"] || "");
  const confirmPassword = String(options["confirm-password"] || "");

  if (!password) {
    return NextResponse.json({ success: false, message: "Password is required" });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ success: false, message: "Passwords do not match" });
  }

  const encryption = String(options["encryption"] || "aes-128");
  const allowPrint = Boolean(options["allow-print"] ?? true);
  const allowCopy = Boolean(options["allow-copy"] ?? false);
  const allowEdit = Boolean(options["allow-edit"] ?? false);
  const allowAnnotate = Boolean(options["allow-annotate"] ?? true);

  const inputBytes = Buffer.from(await file.arrayBuffer());
  const inputPath = `/tmp/protect_input_${Date.now()}.pdf`;
  const outputPath = `/tmp/protect_output_${Date.now()}.pdf`;

  try {
    await writeFile(inputPath, inputBytes);

    const bits = encryption === "aes-256" ? 256 : 128;

    const args: string[] = [
      "--encrypt",
      `--user-password=${password}`,
      `--owner-password=${password}`,
      `--bits=${bits}`,
      `--print=${allowPrint ? "full" : "none"}`,
      `--extract=${allowCopy ? "y" : "n"}`,
      `--modify=${allowEdit ? "all" : "none"}`,
      `--annotate=${allowAnnotate ? "y" : "n"}`,
      "--",
      inputPath,
      outputPath,
    ];

    if (bits === 128) {
      args.splice(0, 0, "--allow-weak-crypto");
    }

    await runQpdf(args);

    const outputData = await readFile(outputPath);
    const base64 = outputData.toString("base64");

    return NextResponse.json({
      success: true,
      data: base64,
      message: `PDF protected with AES-${bits} encryption. Password required to open.`,
      originalSize: file.size,
      outputSize: outputData.length,
      fileName: file.name.replace(/\.pdf$/i, "_protected.pdf"),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, message: `Failed to protect PDF: ${msg}` });
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

async function handleUnlockPDF(file: File, options: Record<string, string | number | boolean>) {
  const password = String(options["password"] || "");

  const inputBytes = Buffer.from(await file.arrayBuffer());
  const inputPath = `/tmp/unlock_input_${Date.now()}.pdf`;
  const outputPath = `/tmp/unlock_output_${Date.now()}.pdf`;

  try {
    await writeFile(inputPath, inputBytes);

    const args: string[] = password
      ? [`--password=${password}`, "--decrypt", inputPath, outputPath]
      : ["--decrypt", inputPath, outputPath];

    await runQpdf(args);

    const outputData = await readFile(outputPath);
    const base64 = outputData.toString("base64");

    return NextResponse.json({
      success: true,
      data: base64,
      message: "PDF unlocked successfully. Encryption removed, all restrictions cleared.",
      originalSize: file.size,
      outputSize: outputData.length,
      fileName: file.name.replace(/\.pdf$/i, "_unlocked.pdf"),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, message: `Failed to unlock PDF: ${msg}` });
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
