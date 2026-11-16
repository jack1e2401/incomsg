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
import { defaultStorefrontConfig, readStorefrontConfig } from "./storefront.validation.js";

const versionSummarySelect = {
  id: true,
  version: true,
  isPublished: true,
  source: true,
  sourceVersionId: true,
  note: true,
  publishedById: true,
  publishedAt: true,
} satisfies Prisma.StorefrontConfigVersionSelect;

const versionFullSelect = {
  ...versionSummarySelect,
  config: true,
} satisfies Prisma.StorefrontConfigVersionSelect;

function toVersionSummaryDto(row: {
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

function toVersionDto(row: {
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

function toDraftDto(row: { config: Prisma.JsonValue; updatedAt: Date }): StorefrontDraftDto {
  return {
    config: readStorefrontConfig(row.config),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function initializeDefaultStorefrontTx(
  tx: Prisma.TransactionClient,
  merchant: StorefrontMerchantSummaryDto,
  actorId: number | null = null,
): Promise<{ draft: StorefrontDraftDto; published: StorefrontVersionSummaryDto }> {
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

async function assertOwnedFeaturedProductsTx(
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

export const storefrontRepository = {
  async findActiveMerchantBySlug(slug: string): Promise<StorefrontMerchantSummaryDto | null> {
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

  async saveDraft(
    merchant: StorefrontMerchantSummaryDto,
    actorId: number,
    config: StorefrontConfig,
  ): Promise<StorefrontDraftDto> {
    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          await initializeDefaultStorefrontTx(tx, merchant, actorId);
          await assertOwnedFeaturedProductsTx(tx, merchant.id, config.featuredProductIds);
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
          const initialized = await initializeDefaultStorefrontTx(tx, merchant, actorId);
          const draftConfig = initialized.draft.config;
          await assertOwnedFeaturedProductsTx(tx, merchant.id, draftConfig.featuredProductIds);

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

  async listVersions(merchantId: number): Promise<StorefrontVersionSummaryDto[]> {
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
  ): Promise<{ published: StorefrontVersionDto; draft: StorefrontDraftDto } | null> {
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
            targetConfig.featuredProductIds = targetConfig.featuredProductIds.filter((id) =>
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

  async loadDynamicStorefrontData(
    merchantId: number,
    featuredProductIds: number[],
  ): Promise<{
    featuredProducts: StorefrontProductDto[];
    categories: StorefrontCategoryDto[];
    upcomingEvents: StorefrontEventDto[];
  }> {
    const now = new Date();
    const [products, categories, events] = await Promise.all([
      featuredProductIds.length > 0
        ? prisma.product.findMany({
            where: {
              id: { in: featuredProductIds },
              merchantId,
              kind: "SALE",
              status: "ACTIVE",
            },
            select: {
              id: true,
              merchantId: true,
              categoryId: true,
              category: { select: { id: true, name: true, slug: true } },
              sku: true,
              name: true,
              description: true,
              imageUrl: true,
              kind: true,
              status: true,
              price: true,
              inventoryBalance: { select: { onHandQuantity: true, reservedQuantity: true } },
            },
          })
        : Promise.resolve([]),
      prisma.productCategory.findMany({
        where: { merchantId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          merchantId: true,
          name: true,
          slug: true,
          description: true,
          sortOrder: true,
        },
      }),
      prisma.merchantEvent.findMany({
        where: {
          merchantId,
          status: "PUBLISHED",
          endAt: { gte: now },
        },
        orderBy: [{ startAt: "asc" }, { id: "asc" }],
        take: 6,
        select: {
          id: true,
          merchantId: true,
          title: true,
          slug: true,
          description: true,
          bannerUrl: true,
          startAt: true,
          endAt: true,
          locationName: true,
          locationAddress: true,
          status: true,
          publishedAt: true,
        },
      }),
    ]);

    const productById = new Map(
      products.map((product) => [
        product.id,
        {
          id: product.id,
          merchantId: product.merchantId,
          categoryId: product.categoryId,
          category: product.category,
          sku: product.sku,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          kind: product.kind,
          status: product.status,
          price: product.price.toFixed(0),
          inventory: {
            availableQuantity: product.inventoryBalance
              ? product.inventoryBalance.onHandQuantity - product.inventoryBalance.reservedQuantity
              : 0,
          },
        } satisfies StorefrontProductDto,
      ]),
    );

    const orderedProducts = featuredProductIds
      .map((id) => productById.get(id))
      .filter((product): product is StorefrontProductDto => product !== undefined);

    return {
      featuredProducts: orderedProducts,
      categories,
      upcomingEvents: events.map((event) => ({
        ...event,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt.toISOString(),
        publishedAt: event.publishedAt ? event.publishedAt.toISOString() : null,
      })),
    };
  },
};
