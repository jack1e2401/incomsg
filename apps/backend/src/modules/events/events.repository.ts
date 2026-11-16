import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type {
  ListMerchantEventsQuery,
  ListPublicEventsQuery,
  PublicStoreSummaryDto,
} from "./events.types.js";

const eventSelection = {
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
  createdAt: true,
  updatedAt: true,
} as const;

export type EventRow = Prisma.MerchantEventGetPayload<{ select: typeof eventSelection }>;

export function isPrismaUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export const eventsRepository = {
  async findActiveMerchantBySlug(slug: string): Promise<PublicStoreSummaryDto | null> {
    return prisma.merchant.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, slug: true },
    });
  },

  async listByMerchant(merchantId: number, query: ListMerchantEventsQuery): Promise<{
    rows: EventRow[];
    totalItems: number;
  }> {
    const where: Prisma.MerchantEventWhereInput = {
      merchantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q } },
              { locationName: { contains: query.q } },
              { slug: { contains: query.q } },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const [rows, totalItems] = await Promise.all([
      prisma.merchantEvent.findMany({
        where,
        select: eventSelection,
        orderBy: [{ startAt: "desc" }, { id: "desc" }],
        skip,
        take: query.limit,
      }),
      prisma.merchantEvent.count({ where }),
    ]);

    return { rows, totalItems };
  },

  async listPublishedByMerchant(
    merchantId: number,
    query: ListPublicEventsQuery,
    now: Date,
  ): Promise<{ rows: EventRow[]; totalItems: number }> {
    const scopeFilter: Prisma.MerchantEventWhereInput =
      query.scope === "upcoming"
        ? { endAt: { gte: now } }
        : query.scope === "past"
          ? { endAt: { lt: now } }
          : {};

    const where: Prisma.MerchantEventWhereInput = {
      merchantId,
      status: "PUBLISHED",
      ...scopeFilter,
    };

    const orderBy: Prisma.MerchantEventOrderByWithRelationInput[] =
      query.scope === "upcoming"
        ? [{ startAt: "asc" }, { id: "asc" }]
        : [{ startAt: "desc" }, { id: "desc" }];

    const skip = (query.page - 1) * query.limit;
    const [rows, totalItems] = await Promise.all([
      prisma.merchantEvent.findMany({
        where,
        select: eventSelection,
        orderBy,
        skip,
        take: query.limit,
      }),
      prisma.merchantEvent.count({ where }),
    ]);

    return { rows, totalItems };
  },

  async findByIdAndMerchant(id: number, merchantId: number): Promise<EventRow | null> {
    return prisma.merchantEvent.findFirst({
      where: { id, merchantId },
      select: eventSelection,
    });
  },

  async findPublishedBySlugAndMerchant(slug: string, merchantId: number): Promise<EventRow | null> {
    return prisma.merchantEvent.findFirst({
      where: { merchantId, slug, status: "PUBLISHED" },
      select: eventSelection,
    });
  },

  async findBySlugAndMerchant(
    slug: string,
    merchantId: number,
    excludeId?: number,
  ): Promise<{ id: number } | null> {
    return prisma.merchantEvent.findFirst({
      where: {
        merchantId,
        slug,
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  },

  async findSlugsByPrefix(merchantId: number, baseSlug: string): Promise<string[]> {
    const rows = await prisma.merchantEvent.findMany({
      where: {
        merchantId,
        OR: [{ slug: baseSlug }, { slug: { startsWith: `${baseSlug}-` } }],
      },
      select: { slug: true },
    });
    return rows.map((row) => row.slug);
  },

  async create(
    merchantId: number,
    data: {
      title: string;
      slug: string;
      description: string;
      bannerUrl: string | null;
      startAt: Date;
      endAt: Date;
      locationName: string;
      locationAddress: string | null;
    },
  ): Promise<EventRow> {
    return prisma.merchantEvent.create({
      data: {
        merchantId,
        title: data.title,
        slug: data.slug,
        description: data.description,
        bannerUrl: data.bannerUrl,
        startAt: data.startAt,
        endAt: data.endAt,
        locationName: data.locationName,
        locationAddress: data.locationAddress,
        status: "DRAFT",
      },
      select: eventSelection,
    });
  },

  async updateByIdAndMerchant(
    id: number,
    merchantId: number,
    data: {
      title?: string;
      slug?: string;
      description?: string;
      bannerUrl?: string | null;
      startAt?: Date;
      endAt?: Date;
      locationName?: string;
      locationAddress?: string | null;
    },
  ): Promise<EventRow | null> {
    const result = await prisma.merchantEvent.updateMany({
      where: { id, merchantId },
      data,
    });
    if (result.count === 0) return null;
    return this.findByIdAndMerchant(id, merchantId);
  },

  async publish(id: number, merchantId: number, publishedAt: Date): Promise<EventRow | null> {
    const result = await prisma.merchantEvent.updateMany({
      where: { id, merchantId },
      data: { status: "PUBLISHED", publishedAt },
    });
    if (result.count === 0) return null;
    return this.findByIdAndMerchant(id, merchantId);
  },

  async unpublish(id: number, merchantId: number): Promise<EventRow | null> {
    const result = await prisma.merchantEvent.updateMany({
      where: { id, merchantId },
      data: { status: "DRAFT" },
    });
    if (result.count === 0) return null;
    return this.findByIdAndMerchant(id, merchantId);
  },

  async deleteDraft(id: number, merchantId: number): Promise<"DELETED" | "NOT_FOUND" | "NOT_DRAFT"> {
    const deleted = await prisma.merchantEvent.deleteMany({
      where: { id, merchantId, status: "DRAFT" },
    });
    if (deleted.count > 0) return "DELETED";

    const existing = await prisma.merchantEvent.findFirst({
      where: { id, merchantId },
      select: { status: true },
    });
    if (!existing) return "NOT_FOUND";
    return "NOT_DRAFT";
  },
};
