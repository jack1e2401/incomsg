import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { withTransactionRetry } from "../../loyalty/program/loyalty.transaction.js";
import type {
  StorefrontConfig,
  StorefrontDraftDto,
  StorefrontMerchantSummaryDto,
  StorefrontVersionDto,
  StorefrontVersionSummaryDto,
} from "./storefront.types.js";
import { readStorefrontConfig } from "./storefront.validation.js";
import {
  assertOwnedFeaturedProductsTx,
  initializeDefaultStorefrontTx,
  toDraftDto,
  toVersionDto,
  toVersionSummaryDto,
  versionFullSelect,
  versionSummarySelect,
} from "./storefront.persistence.js";

export const storefrontVersionRepository = {
  async saveDraft(
    merchant: StorefrontMerchantSummaryDto,
    actorId: number,
    config: StorefrontConfig,
  ): Promise<StorefrontDraftDto> {
    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          await initializeDefaultStorefrontTx(tx, merchant, actorId);
          await assertOwnedFeaturedProductsTx(
            tx,
            merchant.id,
            config.featuredProductIds,
          );
          const jsonConfig = config as unknown as Prisma.InputJsonValue;
          const updated = await tx.storefrontDraft.upsert({
            where: { merchantId: merchant.id },
            create: {
              merchantId: merchant.id,
              config: jsonConfig,
              updatedById: actorId,
            },
            update: {
              config: jsonConfig,
              updatedById: actorId,
            },
            select: { config: true, updatedAt: true },
          });
          return toDraftDto(updated);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  },

  async publishDraft(
    merchant: StorefrontMerchantSummaryDto,
    actorId: number,
    note: string | null,
  ): Promise<{ published: StorefrontVersionDto; draft: StorefrontDraftDto }> {
    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const initialized = await initializeDefaultStorefrontTx(
            tx,
            merchant,
            actorId,
          );
          const draftConfig = initialized.draft.config;
          await assertOwnedFeaturedProductsTx(
            tx,
            merchant.id,
            draftConfig.featuredProductIds,
          );

          await tx.storefrontConfigVersion.updateMany({
            where: { merchantId: merchant.id, isPublished: true },
            data: { isPublished: false },
          });

          const aggregate = await tx.storefrontConfigVersion.aggregate({
            where: { merchantId: merchant.id },
            _max: { version: true },
          });
          const nextVersion = (aggregate._max.version ?? 0) + 1;

          const created = await tx.storefrontConfigVersion.create({
            data: {
              merchantId: merchant.id,
              version: nextVersion,
              config: draftConfig as unknown as Prisma.InputJsonValue,
              isPublished: true,
              source: "PUBLISH",
              note,
              publishedById: actorId,
            },
            select: versionFullSelect,
          });

          return {
            published: toVersionDto(created),
            draft: initialized.draft,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  },

  async listVersions(
    merchantId: number,
  ): Promise<StorefrontVersionSummaryDto[]> {
    const rows = await prisma.storefrontConfigVersion.findMany({
      where: { merchantId },
      orderBy: [{ version: "desc" }, { id: "desc" }],
      select: versionSummarySelect,
    });
    return rows.map(toVersionSummaryDto);
  },

  async rollbackToVersion(
    merchant: StorefrontMerchantSummaryDto,
    actorId: number,
    versionId: number,
    note: string | null,
  ): Promise<{
    published: StorefrontVersionDto;
    draft: StorefrontDraftDto;
  } | null> {
    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const target = await tx.storefrontConfigVersion.findFirst({
            where: { id: versionId, merchantId: merchant.id },
            select: versionFullSelect,
          });
          if (!target) return null;

          const targetConfig = readStorefrontConfig(target.config);
          if (targetConfig.featuredProductIds.length > 0) {
            const validProducts = await tx.product.findMany({
              where: {
                id: { in: targetConfig.featuredProductIds },
                merchantId: merchant.id,
                kind: "SALE",
                status: "ACTIVE",
              },
              select: { id: true },
            });
            const validIdSet = new Set(validProducts.map((p) => p.id));
            targetConfig.featuredProductIds =
              targetConfig.featuredProductIds.filter((id) =>
                validIdSet.has(id),
              );
          }

          await tx.storefrontConfigVersion.updateMany({
            where: { merchantId: merchant.id, isPublished: true },
            data: { isPublished: false },
          });

          const aggregate = await tx.storefrontConfigVersion.aggregate({
            where: { merchantId: merchant.id },
            _max: { version: true },
          });
          const nextVersion = (aggregate._max.version ?? 0) + 1;
          const jsonConfig = targetConfig as unknown as Prisma.InputJsonValue;

          const created = await tx.storefrontConfigVersion.create({
            data: {
              merchantId: merchant.id,
              version: nextVersion,
              config: jsonConfig,
              isPublished: true,
              source: "ROLLBACK",
              sourceVersionId: target.id,
              note,
              publishedById: actorId,
            },
            select: versionFullSelect,
          });

          const draft = await tx.storefrontDraft.upsert({
            where: { merchantId: merchant.id },
            create: {
              merchantId: merchant.id,
              config: jsonConfig,
              updatedById: actorId,
            },
            update: {
              config: jsonConfig,
              updatedById: actorId,
            },
            select: { config: true, updatedAt: true },
          });

          return {
            published: toVersionDto(created),
            draft: toDraftDto(draft),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  },
};
