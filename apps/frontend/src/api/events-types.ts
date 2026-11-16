export type EventStatus = "DRAFT" | "PUBLISHED";
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

export interface PublicStoreSummaryDto {
  id: number;
  name: string;
  slug: string;
}

export interface MerchantEventsListResponse {
  items: MerchantEventDto[];
  pagination: EventPaginationDto;
}

export interface MerchantEventResponse {
  event: MerchantEventDto;
}

export interface PublicStoreEventsResponse {
  merchant?: PublicStoreSummaryDto;
  items: MerchantEventDto[];
  pagination: EventPaginationDto;
}

export interface PublicStoreEventDetailResponse {
  merchant?: PublicStoreSummaryDto;
  event: MerchantEventDto;
}

export interface DeleteEventResponse {
  deleted: true;
}

export interface CreateEventInput {
  title: string;
  slug?: string;
  description: string;
  bannerUrl?: string | null;
  startAt: string;
  endAt: string;
  locationName: string;
  locationAddress?: string | null;
}

export interface UpdateEventInput {
  title?: string;
  slug?: string;
  description?: string;
  bannerUrl?: string | null;
  startAt?: string;
  endAt?: string;
  locationName?: string;
  locationAddress?: string | null;
}

export interface ListMerchantEventsParams {
  status?: EventStatus | "";
  q?: string;
  page?: number;
  limit?: number;
}

export interface ListPublicEventsParams {
  scope?: PublicEventScope;
  page?: number;
  limit?: number;
}
