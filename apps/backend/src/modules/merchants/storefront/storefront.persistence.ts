import { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../../lib/http-error.js";
import type {
  StorefrontConfig,
  StorefrontDraftDto,
  StorefrontMerchantSummaryDto,
  StorefrontVersionDto,
  StorefrontVersionSummaryDto,
} from "./storefront.types.js";
import {
  defaultStorefrontConfig,
  readStorefrontConfig,
} from "./storefront.validation.js";

export const versionSummarySelect = {
  id: true,
  version: true,
  isPublished: true,
  source: true,
  sourceVersionId: true,
  note: true,
  publishedById: true,
  publishedAt: true,
} satisfies Prisma.StorefrontConfigVersionSelect;

export const versionFullSelect = {
  ...versionSummarySelect,
  config: true,
} satisfies Prisma.StorefrontConfigVersionSelect;

export function toVersionSummaryDto(row: {
  id: number;
  version: number;
  isPublished: boolean;
  source: StorefrontVersionSummaryDto["source"];
  sourceVersionId: number | null;
  note: string | null;
  publishedById: number | null;
  publishedAt: Date;
}): StorefrontVersionSummaryDto {
  return {
    id: row.id,
    version: row.version,
    isPublished: row.isPublished,
    source: row.source,
    sourceVersionId: row.sourceVersionId,
    note: row.note,
    publishedById: row.publishedById,
    publishedAt: row.publishedAt.toISOString(),
  };
}

export function toVersionDto(row: {
  id: number;
  version: number;
  isPublished: boolean;
  source: StorefrontVersionDto["source"];
  sourceVersionId: number | null;
  note: string | null;
  publishedById: number | null;
  publishedAt: Date;
  config: Prisma.JsonValue;
}): StorefrontVersionDto {
  return {
    ...toVersionSummaryDto(row),
    config: readStorefrontConfig(row.config),
  };
}

export function toDraftDto(row: {
  config: Prisma.JsonValue;
  updatedAt: Date;
}): StorefrontDraftDto {
  return {
    config: readStorefrontConfig(row.config),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function initializeDefaultStorefrontTx(
  tx: Prisma.TransactionClient,
  merchant: StorefrontMerchantSummaryDto,
  actorId: number | null = null,
): Promise<{
  draft: StorefrontDraftDto;
  published: StorefrontVersionSummaryDto;
}> {
  const initialConfig = defaultStorefrontConfig(merchant.name, merchant.slug);
  const jsonConfig = initialConfig as unknown as Prisma.InputJsonValue;

  let existingPublished = await tx.storefrontConfigVersion.findFirst({
    where: { merchantId: merchant.id, isPublished: true },
    select: versionSummarySelect,
  });

  if (!existingPublished) {
    const anyVersion = await tx.storefrontConfigVersion.findFirst({
      where: { merchantId: merchant.id },
      orderBy: { version: "desc" },
      select: versionSummarySelect,
    });
    if (anyVersion) {
      await tx.storefrontConfigVersion.update({
        where: { id: anyVersion.id },
        data: { isPublished: true },
      });
      existingPublished = { ...anyVersion, isPublished: true };
    } else {
      existingPublished = await tx.storefrontConfigVersion.create({
        data: {
          merchantId: merchant.id,
          version: 1,
          config: jsonConfig,
          isPublished: true,
          source: "DEFAULT_INIT",
          publishedById: actorId,
        },
        select: versionSummarySelect,
      });
    }
  }

  let draft = await tx.storefrontDraft.findUnique({
    where: { merchantId: merchant.id },
    select: { config: true, updatedAt: true },
  });
  if (!draft) {
    draft = await tx.storefrontDraft.create({
      data: {
        merchantId: merchant.id,
        config: jsonConfig,
        updatedById: actorId,
      },
      select: { config: true, updatedAt: true },
    });
  }

  return {
    draft: toDraftDto(draft),
    published: toVersionSummaryDto(existingPublished),
  };
}

export async function assertOwnedFeaturedProductsTx(
  tx: Prisma.TransactionClient,
  merchantId: number,
  featuredProductIds: number[],
): Promise<void> {
  if (featuredProductIds.length === 0) return;
  const rows = await tx.product.findMany({
    where: {
      id: { in: featuredProductIds },
      merchantId,
      kind: "SALE",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (rows.length !== featuredProductIds.length) {
    throw new HttpError(400, "INVALID_FEATURED_PRODUCTS");
  }
}
