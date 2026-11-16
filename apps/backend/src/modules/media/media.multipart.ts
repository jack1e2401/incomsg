import type { IncomingMessage } from "node:http";
import { HttpError } from "../../lib/http-error.js";

export const MAX_MEDIA_FILE_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const MAX_HARD_DRAIN_BYTES = 20 * 1024 * 1024;

export interface DetectedImage {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  ext: "png" | "jpg" | "webp";
}

export interface ParsedUploadedFile {
  buffer: Buffer;
  detected: DetectedImage;
}

export function detectImageFormat(buffer: Buffer, declaredMime?: string): DetectedImage {
  let detected: DetectedImage | null = null;

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detected = { mimeType: "image/png", ext: "png" };
  } else if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detected = { mimeType: "image/jpeg", ext: "jpg" };
  } else if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    detected = { mimeType: "image/webp", ext: "webp" };
  }

  if (!detected) {
    throw new HttpError(400, "INVALID_FILE_TYPE");
  }

  if (declaredMime) {
    const normalized = declaredMime.split(";")[0]?.trim().toLowerCase();
    if (normalized && normalized !== "application/octet-stream") {
      const canonical = normalized === "image/jpg" ? "image/jpeg" : normalized;
      if (canonical !== detected.mimeType) {
        throw new HttpError(400, "INVALID_FILE_TYPE");
      }
    }
  }

  return detected;
}

export function extractMultipartBoundary(contentType: string | undefined): string {
  if (!contentType || !contentType.toLowerCase().includes("multipart/form-data")) {
    throw new HttpError(400, "FILE_REQUIRED");
  }
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const boundary = (match?.[1] ?? match?.[2] ?? "").trim();
  if (!boundary) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return boundary;
}

export async function readMultipartRequestBody(
  request: IncomingMessage,
  maxBytes: number = MAX_MEDIA_FILE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES,
): Promise<Buffer> {
  const contentLengthHeader = request.headers["content-length"];
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new HttpError(413, "FILE_TOO_LARGE");
    }
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let exceeded = false;
    let settled = false;

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    request.on("data", (chunk: Buffer | string) => {
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      totalBytes += buf.length;
      if (totalBytes > MAX_HARD_DRAIN_BYTES) {
        request.destroy();
        fail(new HttpError(413, "FILE_TOO_LARGE"));
        return;
      }
      if (totalBytes > maxBytes) {
        exceeded = true;
        chunks.length = 0;
        return;
      }
      if (!exceeded) {
        chunks.push(buf);
      }
    });

    request.on("end", () => {
      if (settled) return;
      settled = true;
      if (exceeded) {
        reject(new HttpError(413, "FILE_TOO_LARGE"));
        return;
      }
      resolve(Buffer.concat(chunks, totalBytes));
    });

    request.on("error", (error) => {
      fail(error);
    });
  });
}

export function parseSingleFileMultipartBuffer(body: Buffer, boundary: string): ParsedUploadedFile {
  const delimiter = Buffer.from(`--${boundary}`, "latin1");
  const headerSeparator = Buffer.from("\r\n\r\n", "latin1");

  let cursor = body.indexOf(delimiter);
  if (cursor === -1) {
    throw new HttpError(400, "FILE_REQUIRED");
  }

  let foundFile: { data: Buffer; declaredMime?: string } | null = null;

  while (cursor !== -1) {
    const afterDelimiter = cursor + delimiter.length;
    if (body[afterDelimiter] === 0x2d && body[afterDelimiter + 1] === 0x2d) {
      // "--" closing boundary
      break;
    }

    let partStart = afterDelimiter;
    if (body[partStart] === 0x0d && body[partStart + 1] === 0x0a) {
      partStart += 2;
    } else if (body[partStart] === 0x0a) {
      partStart += 1;
    }

    const nextBoundaryIndex = body.indexOf(delimiter, partStart);
    if (nextBoundaryIndex === -1) {
      break;
    }

    let partEnd = nextBoundaryIndex;
    if (partEnd >= 2 && body[partEnd - 2] === 0x0d && body[partEnd - 1] === 0x0a) {
      partEnd -= 2;
    } else if (partEnd >= 1 && body[partEnd - 1] === 0x0a) {
      partEnd -= 1;
    }

    const sepIndex = body.indexOf(headerSeparator, partStart);
    if (sepIndex !== -1 && sepIndex < partEnd) {
      const rawHeaders = body.subarray(partStart, sepIndex).toString("utf8");
      const partData = body.subarray(sepIndex + headerSeparator.length, partEnd);

      const dispositionLine = rawHeaders
        .split(/\r?\n/)
        .find((line) => line.toLowerCase().startsWith("content-disposition:"));
      const nameMatch = dispositionLine ? /;\s*name="([^"]+)"/i.exec(dispositionLine) : null;
      const fieldName = nameMatch?.[1];

      if (fieldName === "file") {
        if (foundFile !== null) {
          throw new HttpError(400, "INVALID_INPUT");
        }
        const contentTypeLine = rawHeaders
          .split(/\r?\n/)
          .find((line) => line.toLowerCase().startsWith("content-type:"));
        const declaredMime = contentTypeLine
          ? contentTypeLine.slice(contentTypeLine.indexOf(":") + 1).trim()
          : undefined;
        foundFile = { data: partData, declaredMime };
      }
    }

    cursor = nextBoundaryIndex;
  }

  if (!foundFile || foundFile.data.length === 0) {
    throw new HttpError(400, "FILE_REQUIRED");
  }

  if (foundFile.data.length > MAX_MEDIA_FILE_BYTES) {
    throw new HttpError(413, "FILE_TOO_LARGE");
  }

  const detected = detectImageFormat(foundFile.data, foundFile.declaredMime);
  return {
    buffer: foundFile.data,
    detected,
  };
}
