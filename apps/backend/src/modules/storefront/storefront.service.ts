import { HttpError } from "../../lib/http-error.js";
import { merchantService } from "../merchant/merchant.service.js";
import { storefrontRepository } from "./storefront.repository.js";
import { isValidStoreSlug } from "./storefront.slug.js";
import type {
  MerchantStorefrontPreviewDto,
  MerchantStorefrontStateDto,
  PublicStorefrontDto,
  StorefrontConfig,
  StorefrontDraftDto,
  StorefrontVersionDto,
  StorefrontVersionSummaryDto,
} from "./storefront.types.js";

function toVersionSummary(version: StorefrontVersionDto): StorefrontVersionSummaryDto {
  return {
    id: version.id,
    version: version.version,
    isPublished: version.isPublished,
    source: version.source,
    sourceVersionId: version.sourceVersionId,
    note: version.note,
    publishedById: version.publishedById,
    publishedAt: version.publishedAt,
  };
}

export const storefrontService = {
  async getMerchantStorefront(ownerId: number): Promise<MerchantStorefrontStateDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const { draft, published } = await storefrontRepository.ensureInitialized(merchant, ownerId);
    return {
      merchant,
      draft,
      published: toVersionSummary(published),
    };
  },

  async saveDraft(ownerId: number, config: StorefrontConfig): Promise<{ draft: StorefrontDraftDto }> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const draft = await storefrontRepository.saveDraft(merchant, ownerId, config);
    return { draft };
  },

  async getPreview(ownerId: number): Promise<MerchantStorefrontPreviewDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const { draft } = await storefrontRepository.ensureInitialized(merchant, ownerId);
    const dynamic = await storefrontRepository.loadDynamicStorefrontData(
      merchant.id,
      draft.config.featuredProductIds,
    );
    return {
      merchant: { id: merchant.id, name: merchant.name, slug: merchant.slug },
      config: draft.config,
      isDraftPreview: true,
      ...dynamic,
    };
  },

  async publish(
    ownerId: number,
    note: string | null,
  ): Promise<{ published: StorefrontVersionDto; draft: StorefrontDraftDto }> {
    const merchant = await merchantService.getOwnStore(ownerId);
    return storefrontRepository.publishDraft(merchant, ownerId, note);
  },

  async listVersions(ownerId: number): Promise<{ versions: StorefrontVersionSummaryDto[] }> {
    const merchant = await merchantService.getOwnStore(ownerId);
    await storefrontRepository.ensureInitialized(merchant, ownerId);
    const versions = await storefrontRepository.listVersions(merchant.id);
    return { versions };
  },

  async rollbackVersion(
    ownerId: number,
    versionId: number,
    note: string | null,
  ): Promise<{ published: StorefrontVersionDto; draft: StorefrontDraftDto }> {
    const merchant = await merchantService.getOwnStore(ownerId);
    await storefrontRepository.ensureInitialized(merchant, ownerId);
    const result = await storefrontRepository.rollbackToVersion(merchant, ownerId, versionId, note);
    if (!result) {
      throw new HttpError(404, "VERSION_NOT_FOUND");
    }
    return result;
  },

  async getPublicStorefront(slug: string): Promise<PublicStorefrontDto> {
    const normalizedSlug = slug.trim();
    if (!isValidStoreSlug(normalizedSlug)) {
      throw new HttpError(404, "MERCHANT_NOT_FOUND");
    }
    const merchant = await storefrontRepository.findActiveMerchantBySlug(normalizedSlug);
    if (!merchant) {
      throw new HttpError(404, "MERCHANT_NOT_FOUND");
    }
    const { published } = await storefrontRepository.ensureInitialized(merchant, null);
    const dynamic = await storefrontRepository.loadDynamicStorefrontData(
      merchant.id,
      published.config.featuredProductIds,
    );
    return {
      merchant,
      version: toVersionSummary(published),
      config: published.config,
      ...dynamic,
    };
  },
};
