import type { Request, Response, NextFunction } from "express";
import multer, { MulterError, FileFilterCallback } from "multer";
import path from "path";

/**
 * Reusable hardened multer (2.x) upload middleware factory.
 *
 * Security posture:
 * - memoryStorage only (no arbitrary disk paths / path traversal via destination)
 * - hard limits on file size and file count
 * - MIME allowlist AND extension allowlist (case-insensitive)
 * - explicit denylist of executable/script extensions and dangerous MIME types
 * - rejects path separators / traversal sequences in originalname
 *
 * NOTE: This does NOT perform virus/malware scanning. See UPLOAD_SECURITY_NOTES.md.
 */

export interface SecureUploadOptions {
  /** Allowed MIME types (lowercase compared, case-insensitive). */
  allowedMime: string[];
  /** Allowed extensions including leading dot, e.g. ".csv" (case-insensitive). */
  allowedExt: string[];
  /** Max bytes per file. Default 5MB. */
  maxBytes?: number;
  /** Max number of files. Default 1. */
  maxFiles?: number;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_FILES = 1;

/** Extensions that must always be rejected regardless of allowlist. */
export const DANGEROUS_EXTENSIONS = [
  ".exe",
  ".sh",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".js",
  ".mjs",
  ".php",
  ".py",
  ".rb",
  ".pl",
  ".jar",
  ".html",
  ".htm",
  ".svg",
];

/** MIME types that must always be rejected regardless of allowlist. */
export const DANGEROUS_MIME = [
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-sh",
  "application/x-bat",
  "application/x-executable",
  "application/x-elf",
  "application/x-mach-binary",
  "application/x-dosexec",
  "application/java-archive",
  "application/x-php",
  "application/x-httpd-php",
  "text/html",
  "image/svg+xml",
  "application/javascript",
  "text/javascript",
];

/**
 * Sanitize an uploaded file's original name:
 * - strip any directory components (basename only)
 * - allow only [A-Za-z0-9._-]
 * - collapse repeated separators
 * - cap length
 */
export function safeFilename(name: string): string {
  if (!name) return "file";
  // basename strips directory components from both posix and win paths
  let base = path.basename(name).replace(/\\/g, "/");
  base = base.substring(base.lastIndexOf("/") + 1);
  // replace disallowed chars
  base = base.replace(/[^A-Za-z0-9._-]/g, "_");
  // collapse repeated underscores/dots
  base = base.replace(/_{2,}/g, "_").replace(/\.{2,}/g, ".");
  // strip leading dots/dashes to avoid hidden files / option-like names
  base = base.replace(/^[.\-_]+/, "");
  if (!base) base = "file";
  // cap length (preserve extension if possible)
  const MAX_LEN = 120;
  if (base.length > MAX_LEN) {
    const ext = path.extname(base);
    const stem = base.slice(0, MAX_LEN - ext.length);
    base = stem + ext;
  }
  return base;
}

function hasPathSeparators(name: string): boolean {
  return /[\\/]/.test(name) || name.includes("..") || name.includes("\0");
}

function buildFileFilter(opts: SecureUploadOptions) {
  const allowedMime = new Set(opts.allowedMime.map((m) => m.toLowerCase()));
  const allowedExt = new Set(opts.allowedExt.map((e) => e.toLowerCase()));
  const dangerousExt = new Set(DANGEROUS_EXTENSIONS);
  const dangerousMime = new Set(DANGEROUS_MIME);

  return function fileFilter(
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) {
    const originalName = file.originalname || "";

    // Reject path separators / traversal in original filename
    if (hasPathSeparators(originalName)) {
      return cb(new MulterError("LIMIT_UNEXPECTED_FILE", "invalid filename"));
    }

    const ext = path.extname(originalName).toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();

    // Always reject dangerous extensions / MIME
    if (dangerousExt.has(ext) || dangerousMime.has(mime)) {
      return cb(new MulterError("LIMIT_UNEXPECTED_FILE", "file type not allowed"));
    }

    // Enforce allowlists
    if (!allowedExt.has(ext)) {
      return cb(new MulterError("LIMIT_UNEXPECTED_FILE", "extension not allowed"));
    }
    if (!allowedMime.has(mime)) {
      return cb(new MulterError("LIMIT_UNEXPECTED_FILE", "mime type not allowed"));
    }

    return cb(null, true);
  };
}

/**
 * Create a hardened multer instance using in-memory storage.
 */
export function createSecureUpload(opts: SecureUploadOptions) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: opts.maxBytes ?? DEFAULT_MAX_BYTES,
      files: opts.maxFiles ?? DEFAULT_MAX_FILES,
    },
    fileFilter: buildFileFilter(opts),
  });
}

/** Ready-made CSV upload preset for future import features. */
export const csvUpload = createSecureUpload({
  allowedMime: [
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
  ],
  allowedExt: [".csv"],
  maxBytes: 5 * 1024 * 1024,
  maxFiles: 1,
});

/**
 * Standard error envelope (mirrors server/utils/api-error.ts errorEnvelope).
 * Inlined here to keep this middleware self-contained.
 */
function uploadErrorEnvelope(
  code: string,
  message: string,
  details?: unknown,
) {
  return {
    success: false as const,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    // top-level message preserved for frontend backward-compat
    message,
  };
}

/**
 * Express error handler for multer errors. Mount AFTER routes that use
 * createSecureUpload(...). Returns the standard error envelope.
 */
export function handleUploadError(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(413)
        .json(uploadErrorEnvelope("FILE_TOO_LARGE", "File is too large"));
    }
    const reason = err.field ? `${err.message}` : err.message;
    return res
      .status(400)
      .json(uploadErrorEnvelope("UPLOAD_REJECTED", reason || "Upload rejected"));
  }
  return next(err);
}
