import { useEffect, useRef, useState } from "react";
import { useOptionalAuthSession } from "../../api/auth-session";
import { createAnalyticsClient } from "../../api/analytics-client";
import type { EnsureMembershipResponse } from "../../api/analytics-types";

const client = createAnalyticsClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function useEnsureMembership(params: {
  slug?: string;
  merchantId?: number;
  enabled?: boolean;
}) {
  const session = useOptionalAuthSession();
  const user = session?.user ?? null;
  const accessToken = session?.accessToken ?? null;
  const [state, setState] = useState<{
    membership: EnsureMembershipResponse["membership"] | null;
    created: boolean;
    loading: boolean;
    error: string | null;
  }>({
    membership: null,
    created: false,
    loading: false,
    error: null,
  });
  const ensuredKeyRef = useRef<string | null>(null);

  const enabled = params.enabled ?? true;
  const slug = params.slug?.trim() || undefined;
  const merchantId = params.merchantId;

  useEffect(() => {
    if (!enabled || !accessToken || user?.role !== "MEMBER") return;
    if (!slug && (!merchantId || !Number.isInteger(merchantId) || merchantId < 1)) return;

    const targetKey = `${user.id}:${slug ? `slug:${slug}` : `id:${merchantId}`}`;
    if (ensuredKeyRef.current === targetKey) return;
    ensuredKeyRef.current = targetKey;

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const request = slug
      ? client.ensureStoreMembershipBySlug(slug, accessToken)
      : client.ensureStoreMembershipByMerchantId(merchantId!, accessToken);

    request
      .then((result) => {
        if (cancelled) return;
        setState({
          membership: result.membership,
          created: result.created,
          loading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        ensuredKeyRef.current = null;
        setState({
          membership: null,
          created: false,
          loading: false,
          error: error instanceof Error ? error.message : "Không thể đồng bộ thành viên",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, enabled, merchantId, slug, user?.id, user?.role]);

  return state;
}
