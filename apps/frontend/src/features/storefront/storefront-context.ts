import { useOutletContext } from "react-router-dom";
import type {
  StorefrontCategoryDto,
  StorefrontConfig,
  StorefrontEventDto,
  StorefrontMerchantSummaryDto,
  StorefrontProductDto,
} from "../../api/storefront-types";
import type { useMemberCart } from "../member/useMemberCart";

export interface StorefrontShellData {
  merchant: StorefrontMerchantSummaryDto;
  config: StorefrontConfig;
  featuredProducts: StorefrontProductDto[];
  categories: StorefrontCategoryDto[];
  upcomingEvents: StorefrontEventDto[];
  isDraftPreview: boolean;
}

export interface StorefrontShellContext {
  merchantId: number;
  basePath: string;
  slug: string;
  accent: string;
  storefront: StorefrontShellData;
  cart: ReturnType<typeof useMemberCart>;
}

export function useStorefrontShell(): StorefrontShellContext | null {
  return useOutletContext<StorefrontShellContext | null>() ?? null;
}
