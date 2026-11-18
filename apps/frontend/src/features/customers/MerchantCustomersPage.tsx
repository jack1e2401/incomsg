import { useState, type FormEvent } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { createAnalyticsClient } from "../../api/analytics-client";
import type { CustomerPurchaseStatus } from "../../api/analytics-types";
import { useAuthSession } from "../../api/auth-session";
import type { MemberTier } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusText,
} from "../../components/ui";
import { money } from "../../lib/utils";

const analyticsApi = createAnalyticsClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function tierLabel(tier: MemberTier) {
  return tier === "UNRANKED" ? "Chưa xếp hạng" : tier;
}

export function MerchantCustomersPage() {
  const { accessToken } = useAuthSession();
  const [draftQuery, setDraftQuery] = useState("");
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<MemberTier | "">("");
  const [purchaseStatus, setPurchaseStatus] = useState<CustomerPurchaseStatus>("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const resource = useResource(
    () =>
      analyticsApi.listMerchantCustomers(
        {
          q,
          tier: tier || undefined,
          purchaseStatus,
          page,
          limit,
        },
        accessToken!,
      ),
    [accessToken, q, tier, purchaseStatus, page],
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQ(draftQuery.trim());
    setPage(1);
  }

  const items = resource.data?.items ?? [];
  const pagination = resource.data?.pagination ?? { page: 1, limit, totalItems: 0, totalPages: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khách hàng"
        description="Danh sách thành viên đã tham gia cửa hàng, điểm Loyalty và giá trị mua hàng."
      />

      <form className="grid gap-3 sm:grid-cols-[1fr_11rem_12rem_auto] sm:items-end" onSubmit={handleSearch}>
        <Field label="Tìm theo email">
          <Input
            type="search"
            placeholder="member@example.com"
            value={draftQuery}
            maxLength={191}
            onChange={(event) => setDraftQuery(event.target.value)}
          />
        </Field>
        <Field label="Hạng thành viên">
          <Select
            aria-label="Hạng thành viên"
            value={tier}
            onChange={(event) => {
              setTier(event.target.value as MemberTier | "");
              setPage(1);
            }}
          >
            <option value="">Tất cả hạng</option>
            <option value="UNRANKED">Chưa xếp hạng</option>
            <option value="BRONZE">BRONZE</option>
            <option value="SILVER">SILVER</option>
            <option value="GOLD">GOLD</option>
            <option value="PLATINUM">PLATINUM</option>
          </Select>
        </Field>
        <Field label="Trạng thái mua hàng">
          <Select
            aria-label="Trạng thái mua hàng"
            value={purchaseStatus}
            onChange={(event) => {
              setPurchaseStatus(event.target.value as CustomerPurchaseStatus);
              setPage(1);
            }}
          >
            <option value="all">Tất cả</option>
            <option value="buyers">Đã có đơn</option>
            <option value="non_buyers">Chưa mua hàng</option>
          </Select>
        </Field>
        <Button type="submit" variant="outline" className="h-11">
          Tìm
        </Button>
      </form>

      {resource.loading ? (
        <LoadingState cards={3} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Chưa có khách hàng phù hợp"
          description={
            q || tier || purchaseStatus !== "all"
              ? "Thử thay đổi bộ lọc tìm kiếm."
              : "Khách hàng sẽ xuất hiện khi thành viên ghé cửa hàng hoặc hoàn tất đơn hàng."
          }
        />
      ) : (
        <>
          <div className="surface overflow-x-auto rounded-3xl">
            <table aria-label="Danh sách khách hàng" className="w-full min-w-[920px] border-collapse text-left">
              <thead className="bg-[#edf3ee] text-xs font-bold uppercase tracking-wide text-[#344b3b]">
                <tr>
                  <th scope="col" className="px-5 py-4">
                    Khách hàng
                  </th>
                  <th scope="col" className="px-4 py-4">
                    Ngày tham gia
                  </th>
                  <th scope="col" className="px-4 py-4">
                    Hạng
                  </th>
                  <th scope="col" className="px-4 py-4 text-right">
                    Điểm khả dụng / Tích lũy
                  </th>
                  <th scope="col" className="px-4 py-4 text-right">
                    Đơn đã trả
                  </th>
                  <th scope="col" className="px-4 py-4 text-right">
                    Chi tiêu ròng
                  </th>
                  <th scope="col" className="px-4 py-4">
                    Mua gần nhất
                  </th>
                  <th scope="col" className="px-4 py-4">
                    <span className="sr-only">Chi tiết</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.memberId} className="border-t border-[#edf1ea] align-middle text-sm">
                    <th scope="row" className="max-w-64 break-all px-5 py-4 font-bold text-[#20392a]">
                      {item.email}
                      <span className="mt-1 block text-xs font-normal muted">#{item.memberId}</span>
                    </th>
                    <td className="px-4 py-4 text-xs muted">
                      <time dateTime={item.joinedAt}>
                        {new Date(item.joinedAt).toLocaleDateString("vi-VN")}
                      </time>
                    </td>
                    <td className="px-4 py-4">{tierLabel(item.tier)}</td>
                    <td className="px-4 py-4 text-right tabular-nums">
                      <span className="font-bold">{item.availablePoints.toLocaleString("vi-VN")}</span>
                      <span className="mt-0.5 block text-xs muted">Tích lũy {item.netLifetimeEarned}</span>
                      {item.pointDebt !== "0" && (
                        <StatusText tone="red" className="mt-0.5 justify-end">
                          Nợ {item.pointDebt}
                        </StatusText>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">
                      <span className="font-semibold">{item.paidOrderCount}</span>
                      {item.refundPendingOrderCount > 0 && (
                        <StatusText tone="amber" className="mt-0.5 block justify-end">
                          +{item.refundPendingOrderCount} chờ hoàn
                        </StatusText>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold tabular-nums">
                      {money(Number(item.netSpendVnd))}
                      {item.refundPendingOrderCount > 0 && (
                        <span className="mt-0.5 block text-xs font-normal text-[#97682a]">
                          Chờ hoàn {money(Number(item.refundPendingSpendVnd))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs muted">
                      {item.lastPurchaseAt ? (
                        <time dateTime={item.lastPurchaseAt}>
                          {new Date(item.lastPurchaseAt).toLocaleDateString("vi-VN")}
                        </time>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button asChild variant="outline" size="sm" className="whitespace-nowrap">
                        <Link to={`/merchant/customers/${item.memberId}`} aria-label={`Chi tiết ${item.email}`}>
                          Chi tiết <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <nav aria-label="Phân trang khách hàng" className="flex items-center justify-between gap-3">
              <p className="text-xs muted">
                Trang {pagination.page} / {pagination.totalPages} · {pagination.totalItems} khách hàng
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Trang trước
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Trang sau
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
