import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import { merchantService } from "../merchant/merchant.service.js";
import {
  extractMultipartBoundary,
  parseSingleFileMultipartBuffer,
  readMultipartRequestBody,
} from "./media.multipart.js";

export function resolveUploadRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), "uploads"));
}

export interface UploadedMediaDto {
  url: string;
  mimeType: string;
  size: number;
}

export const mediaService = {
  async uploadMerchantImage(ownerId: number, request: IncomingMessage): Promise<UploadedMediaDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const boundary = extractMultipartBoundary(request.headers["content-type"]);
    const rawBody = await readMultipartRequestBody(request);
    const { buffer, detected } = parseSingleFileMultipartBuffer(rawBody, boundary);

    const filename = `${randomUUID()}.${detected.ext}`;
    const merchantDir = path.resolve(resolveUploadRoot(), `merchant-${merchant.id}`);
    await mkdir(merchantDir, { recursive: true });
    const destination = path.resolve(merchantDir, filename);
    await writeFile(destination, buffer);

    return {
      url: `/uploads/merchant-${merchant.id}/${filename}`,
      mimeType: detected.mimeType,
      size: buffer.length,
    };
  },
};
