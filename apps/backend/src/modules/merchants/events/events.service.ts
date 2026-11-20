import { HttpError } from "../../../lib/http-error.js";
import { merchantService } from "../profile/merchant.service.js";
import { eventsRepository, isPrismaUniqueError, type EventRow } from "./events.repository.js";
import type {
  CreateEventInput,
  EventPaginationDto,
  ListMerchantEventsQuery,
  ListPublicEventsQuery,
  MerchantEventDto,
  PublicStoreSummaryDto,
  UpdateEventInput,
} from "./events.types.js";
import { slugifyVietnamese } from "./events.validation.js";

function toEventDto(row: EventRow): MerchantEventDto {
  return {
    id: row.id,
    merchantId: row.merchantId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    bannerUrl: row.bannerUrl,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    locationName: row.locationName,
    locationAddress: row.locationAddress,
    status: row.status,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPagination(page: number, limit: number, totalItems: number): EventPaginationDto {
  return {
    page,
    limit,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / limit),
  };
}

function nextAvailableSlug(baseSlug: string, existingSlugs: string[], offset = 0): string {
  const taken = new Set(existingSlugs);
  if (offset === 0 && !taken.has(baseSlug)) return baseSlug;
  let counter = Math.max(2, offset + 2);
  while (taken.has(`${baseSlug}-${counter}`)) {
    counter += 1;
  }
  return `${baseSlug}-${counter}`;
}

export const eventsService = {
  async listMerchantEvents(
    ownerId: number,
    query: ListMerchantEventsQuery,
  ): Promise<{ items: MerchantEventDto[]; pagination: EventPaginationDto }> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const { rows, totalItems } = await eventsRepository.listByMerchant(merchant.id, query);
    return {
      items: rows.map(toEventDto),
      pagination: toPagination(query.page, query.limit, totalItems),
    };
  },

  async createMerchantEvent(ownerId: number, input: CreateEventInput): Promise<MerchantEventDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const payload = {
      title: input.title,
      description: input.description,
      bannerUrl: input.bannerUrl ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      locationName: input.locationName,
      locationAddress: input.locationAddress ?? null,
    };

    if (input.slug) {
      const conflict = await eventsRepository.findBySlugAndMerchant(input.slug, merchant.id);
      if (conflict) throw new HttpError(409, "EVENT_SLUG_TAKEN");
      try {
        const created = await eventsRepository.create(merchant.id, { ...payload, slug: input.slug });
        return toEventDto(created);
      } catch (error) {
        if (isPrismaUniqueError(error)) throw new HttpError(409, "EVENT_SLUG_TAKEN");
        throw error;
      }
    }

    const baseSlug = slugifyVietnamese(input.title);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existingSlugs = await eventsRepository.findSlugsByPrefix(merchant.id, baseSlug);
      const candidateSlug = nextAvailableSlug(baseSlug, existingSlugs, attempt);
      try {
        const created = await eventsRepository.create(merchant.id, { ...payload, slug: candidateSlug });
        return toEventDto(created);
      } catch (error) {
        if (isPrismaUniqueError(error) && attempt < 4) continue;
        if (isPrismaUniqueError(error)) throw new HttpError(409, "EVENT_SLUG_TAKEN");
        throw error;
      }
    }

    throw new HttpError(409, "EVENT_SLUG_TAKEN");
  },

  async getMerchantEvent(ownerId: number, eventId: number): Promise<MerchantEventDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const event = await eventsRepository.findByIdAndMerchant(eventId, merchant.id);
    if (!event) throw new HttpError(404, "EVENT_NOT_FOUND");
    return toEventDto(event);
  },

  async updateMerchantEvent(
    ownerId: number,
    eventId: number,
    patch: UpdateEventInput,
  ): Promise<MerchantEventDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const existing = await eventsRepository.findByIdAndMerchant(eventId, merchant.id);
    if (!existing) throw new HttpError(404, "EVENT_NOT_FOUND");

    const effectiveStartAt = patch.startAt ?? existing.startAt;
    const effectiveEndAt = patch.endAt ?? existing.endAt;
    if (effectiveEndAt.getTime() <= effectiveStartAt.getTime()) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    if (patch.slug !== undefined && patch.slug !== existing.slug) {
      const conflict = await eventsRepository.findBySlugAndMerchant(patch.slug, merchant.id, eventId);
      if (conflict) throw new HttpError(409, "EVENT_SLUG_TAKEN");
    }

    try {
      const updated = await eventsRepository.updateByIdAndMerchant(eventId, merchant.id, patch);
      if (!updated) throw new HttpError(404, "EVENT_NOT_FOUND");
      return toEventDto(updated);
    } catch (error) {
      if (isPrismaUniqueError(error)) throw new HttpError(409, "EVENT_SLUG_TAKEN");
      throw error;
    }
  },

  async publishMerchantEvent(ownerId: number, eventId: number): Promise<MerchantEventDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const existing = await eventsRepository.findByIdAndMerchant(eventId, merchant.id);
    if (!existing) throw new HttpError(404, "EVENT_NOT_FOUND");

    const publishedAt = existing.publishedAt ?? new Date();
    const updated = await eventsRepository.publish(eventId, merchant.id, publishedAt);
    if (!updated) throw new HttpError(404, "EVENT_NOT_FOUND");
    return toEventDto(updated);
  },

  async unpublishMerchantEvent(ownerId: number, eventId: number): Promise<MerchantEventDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const updated = await eventsRepository.unpublish(eventId, merchant.id);
    if (!updated) throw new HttpError(404, "EVENT_NOT_FOUND");
    return toEventDto(updated);
  },

  async deleteMerchantEvent(ownerId: number, eventId: number): Promise<{ deleted: true }> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const outcome = await eventsRepository.deleteDraft(eventId, merchant.id);
    if (outcome === "NOT_FOUND") throw new HttpError(404, "EVENT_NOT_FOUND");
    if (outcome === "NOT_DRAFT") throw new HttpError(409, "EVENT_NOT_DRAFT");
    return { deleted: true };
  },

  async listPublicStoreEvents(
    storeSlug: string,
    query: ListPublicEventsQuery,
  ): Promise<{
    merchant: PublicStoreSummaryDto;
    items: MerchantEventDto[];
    pagination: EventPaginationDto;
  }> {
    const merchant = await eventsRepository.findActiveMerchantBySlug(storeSlug);
    if (!merchant) throw new HttpError(404, "MERCHANT_NOT_FOUND");

    const { rows, totalItems } = await eventsRepository.listPublishedByMerchant(
      merchant.id,
      query,
      new Date(),
    );
    return {
      merchant,
      items: rows.map(toEventDto),
      pagination: toPagination(query.page, query.limit, totalItems),
    };
  },

  async getPublicStoreEvent(
    storeSlug: string,
    eventSlug: string,
  ): Promise<{ merchant: PublicStoreSummaryDto; event: MerchantEventDto }> {
    const merchant = await eventsRepository.findActiveMerchantBySlug(storeSlug);
    if (!merchant) throw new HttpError(404, "MERCHANT_NOT_FOUND");

    const event = await eventsRepository.findPublishedBySlugAndMerchant(eventSlug, merchant.id);
    if (!event) throw new HttpError(404, "EVENT_NOT_FOUND");
    return { merchant, event: toEventDto(event) };
  },
};
