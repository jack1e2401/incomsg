import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { withTransactionRetry } from "../loyalty/loyalty.transaction.js";
import type {
  StorefrontCategoryDto,
  StorefrontConfig,
  StorefrontDraftDto,
  StorefrontEventDto,
  StorefrontMerchantSummaryDto,
  StorefrontProductDto,
  StorefrontVersionDto,
  StorefrontVersionSummaryDto,
} from "./storefront.types.js";
import {
  defaultStorefrontConfig,
  readStorefrontConfig,
} from "./storefront.validation.js";
import { storefrontPublicRepository } from "./storefront.public.repository.js";
import { storefrontVersionRepository } from "./storefront.versions.repository.js";
import {
  initializeDefaultStorefrontTx,
  toDraftDto,
  toVersionDto,
  versionFullSelect,
} from "./storefront.persistence.js";
export { initializeDefaultStorefrontTx } from "./storefront.persistence.js";

export const storefrontRepository = {
  ...storefrontPublicRepository,
  async findActiveMerchantBySlug(
    slug: string,
  ): Promise<StorefrontMerchantSummaryDto | null> {
    return prisma.merchant.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, slug: true },
    });
  },

  async ensureInitialized(
    merchant: StorefrontMerchantSummaryDto,
    actorId: number | null = null,
  ): Promise<{ draft: StorefrontDraftDto; published: StorefrontVersionDto }> {
    const [draft, published] = await Promise.all([
      prisma.storefrontDraft.findUnique({
        where: { merchantId: merchant.id },
        select: { config: true, updatedAt: true },
      }),
      prisma.storefrontConfigVersion.findFirst({
        where: { merchantId: merchant.id, isPublished: true },
        orderBy: { version: "desc" },
        select: versionFullSelect,
      }),
    ]);

    if (draft && published) {
      return { draft: toDraftDto(draft), published: toVersionDto(published) };
    }

    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          await initializeDefaultStorefrontTx(tx, merchant, actorId);
          const [ensuredDraft, ensuredPublished] = await Promise.all([
            tx.storefrontDraft.findUniqueOrThrow({
              where: { merchantId: merchant.id },
              select: { config: true, updatedAt: true },
            }),
            tx.storefrontConfigVersion.findFirstOrThrow({
              where: { merchantId: merchant.id, isPublished: true },
              orderBy: { version: "desc" },
              select: versionFullSelect,
            }),
          ]);
          return {
            draft: toDraftDto(ensuredDraft),
            published: toVersionDto(ensuredPublished),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  },

  ...storefrontVersionRepository,
};
