import path from "path";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { env } from "@/config/env";
import { AppError } from "@/utils/errors";

const AUDIO_EXTENSIONS: Record<string, Set<string>> = {
  "audio/mpeg": new Set(["mp3", "mpga", "mpeg"]),
  "audio/wav": new Set(["wav"]),
  "audio/ogg": new Set(["ogg", "oga", "opus"]),
  "audio/flac": new Set(["flac"]),
  "audio/aac": new Set(["aac"]),
  "audio/mp4": new Set(["m4a", "mp4"]),
};

const IMAGE_EXTENSIONS: Record<string, Set<string>> = {
  "image/png": new Set(["png"]),
  "image/jpeg": new Set(["jpg", "jpeg"]),
  "image/webp": new Set(["webp"]),
};

const MIME_ALIASES: Record<string, string> = {
  "audio/mp3": "audio/mpeg",
  "audio/x-wav": "audio/wav",
  "audio/x-flac": "audio/flac",
};

const storage: multer.StorageEngine = {
  _handleFile(_req, file, callback) {
    const maxSize = file.fieldname === "audio" ? env.maxAudioFileSizeBytes : env.maxArtworkFileSizeBytes;
    const chunks: Buffer[] = [];
    let size = 0;
    let exceeded = false;
    file.stream.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSize) {
        exceeded = true;
        chunks.length = 0;
      } else if (!exceeded) {
        chunks.push(chunk);
      }
    });
    file.stream.once("limit", () => { exceeded = true; chunks.length = 0; });
    file.stream.once("error", callback);
    file.stream.once("end", () => {
      if (exceeded) return callback(new multer.MulterError("LIMIT_FILE_SIZE", file.fieldname));
      callback(null, { buffer: Buffer.concat(chunks), size });
    });
  },
  _removeFile(_req, file, callback) {
    file.buffer = Buffer.alloc(0);
    callback(null);
  },
};

function extensionOf(file: Express.Multer.File) {
  return path.extname(file.originalname).slice(1).toLowerCase();
}

function checkDeclaredType(file: Express.Multer.File, allowed: Record<string, Set<string>>) {
  const declaredMime = MIME_ALIASES[file.mimetype] ?? file.mimetype;
  const extension = extensionOf(file);
  if (!allowed[declaredMime]?.has(extension)) {
    throw new AppError("File extension and declared type are not supported", 422, "UNSUPPORTED_FILE_TYPE");
  }
}

async function inspectFile(file: Express.Multer.File, allowed: Record<string, Set<string>>) {
  checkDeclaredType(file, allowed);
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !allowed[detected.mime]?.has(detected.ext)) {
    throw new AppError("File contents do not match a supported file type", 422, "INVALID_FILE_CONTENT");
  }
  return { extension: detected.ext, mimeType: detected.mime };
}

export async function inspectAudioFile(file: Express.Multer.File) {
  if (file.size > env.maxAudioFileSizeBytes) {
    throw new AppError("Audio file exceeds the configured size limit", 413, "FILE_TOO_LARGE");
  }
  return inspectFile(file, AUDIO_EXTENSIONS);
}

export async function inspectArtworkFile(file: Express.Multer.File) {
  if (file.size > env.maxArtworkFileSizeBytes) {
    throw new AppError("Artwork exceeds the configured size limit", 413, "FILE_TOO_LARGE");
  }
  return inspectFile(file, IMAGE_EXTENSIONS);
}

function fileFilter(allowed: Record<string, Set<string>>) {
  return (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    try {
      checkDeclaredType(file, allowed);
      cb(null, true);
    } catch (error) {
      cb(error as Error);
    }
  };
}

export const uploadSong = multer({
  storage,
  limits: {
    fileSize: Math.max(env.maxAudioFileSizeBytes, env.maxArtworkFileSizeBytes),
    files: 2,
    fields: 6,
    parts: 8,
    fieldSize: 2048,
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "audio") return fileFilter(AUDIO_EXTENSIONS)(req, file, cb);
    if (file.fieldname === "artwork") return fileFilter(IMAGE_EXTENSIONS)(req, file, cb);
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  },
}).fields([
  { name: "audio", maxCount: 1 },
  { name: "artwork", maxCount: 1 },
]);

export const uploadAvatar = multer({
  storage,
  limits: { fileSize: env.maxArtworkFileSizeBytes, files: 1 },
  fileFilter: fileFilter(IMAGE_EXTENSIONS),
}).single("avatar");
