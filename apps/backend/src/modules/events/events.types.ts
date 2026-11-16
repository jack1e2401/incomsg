import type { EventStatus } from "../../generated/prisma/enums.js";

export type PublicEventScope = "upcoming" | "past" | "all";

export interface EventPaginationDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface MerchantEventDto {
  id: number;
  merchantId: number;
  title: string;
  slug: string;
  description: string;
  bannerUrl: string | null;
  startAt: string;
  endAt: string;
  locationName: string;
  locationAddress: string | null;
  status: EventStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  slug?: string;
  description: string;
  bannerUrl?: string | null;
  startAt: Date;
  endAt: Date;
  locationName: string;
  locationAddress?: string | null;
}

export interface UpdateEventInput {
  title?: string;
  slug?: string;
  description?: string;
  bannerUrl?: string | null;
  startAt?: Date;
  endAt?: Date;
  locationName?: string;
  locationAddress?: string | null;
}

export interface ListMerchantEventsQuery {
  status?: EventStatus;
  q?: string;
  page: number;
  limit: number;
}

export interface ListPublicEventsQuery {
  scope: PublicEventScope;
  page: number;
  limit: number;
}

export interface PublicStoreSummaryDto {
  id: number;
  name: string;
  slug: string;
}
