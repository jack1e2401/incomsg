import type { BackendMerchantDto } from "./auth";
import type { MerchantFinanceTier } from "./finance";

export type MerchantDirectoryItem = {
  id: number;
  name: string;
  slug: string;
  isActive?: boolean;
  coverImageUrl?: string | null;
  financeTier?: MerchantFinanceTier;
};

export type MerchantDirectoryResponse = { merchants: MerchantDirectoryItem[] };

export type OwnMerchantResponse = { merchant: BackendMerchantDto };
