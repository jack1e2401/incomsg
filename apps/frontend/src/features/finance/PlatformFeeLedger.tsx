import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { createCommerceClient } from "../../api/commerce-http";
import type { PlatformFeeFilters, PlatformFeeItem, PlatformFeeType } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { pastYearRange } from "../../lib/vietnam-date";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Select,
  StatusText,
} from "../../components/ui";
import { feeMoney, feeRateLabel, financeDateTime, merchantTierLabels } from "./finance-format";
import { PlatformFeeStats } from "./MerchantFinanceOverview";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const feeTypeLabels: Record<PlatformFeeType, string> = {
  FEE_CHARGE: "Ghi nhận phí",
  FEE_REVERSAL: "Hoàn phí",
};

export function PlatformFeeLedger({ token, adminMerchantId }: { token: string; adminMerchantId?: number }) {
  const [range] = useState(pastYearRange);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [type, setType] = useState<PlatformFeeType | "">("");
  const [orderId, setOrderId] = useState("");
  const [filters, setFilters] = useState<PlatformFeeFilters>(range);
  const [cursors, setCursors] = useState<number[]>([]);
  const cursor = cursors.at(-1);
  function loadFees(query: PlatformFeeFilters) {
    return adminMerchantId === undefined
      ? api.getMerchantFinance(token, query)
      : api.getAdminMerchantFees(adminMerchantId, token, query);
  }
  const finance = useResource(
    () => loadFees({ ...filters, cursor }),
    [adminMerchantId, token, filters, cursor],
  );

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCursors([]);
    setFilters({
      from: from || undefined,
      to: to || undefined,
      type: type || undefined,
      orderId: orderId ? Number(orderId) : undefined,
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <form onSubmit={applyFilters} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Từ ngày">
            <Input
              type="date"
              value={from}
              max={to || pastYearRange().to}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label="Đến ngày">
            <Input
              type="date"
              value={to}
              min={from || undefined}
              max={pastYearRange().to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
          <Field label="Loại giao dịch">
            <Select value={type} onChange={(event) => setType(event.target.value as PlatformFeeType | "")}>
              <option value="">Tất cả loại</option>
              <option value="FEE_CHARGE">Ghi nhận phí</option>
              <option value="FEE_REVERSAL">Hoàn phí</option>
            </Select>
          </Field>
          <Field label="Mã đơn hàng">
            <Input
              type="number"
              min={1}
              step={1}
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
            />
          </Field>
          <Button type="submit">Lọc giao dịch</Button>
        </form>
        <p className="mt-3 text-xs muted">
          {filters.from || filters.to
            ? "Ngày phát sinh · Giờ Việt Nam"
            : filters.orderId
              ? "Tất cả các năm của đơn hàng"
              : "Năm hiện tại · Giờ Việt Nam"}
        </p>
      </Card>
      {finance.loading ? (
        <LoadingState cards={2} />
      ) : finance.error ? (
        <ErrorState message={finance.error} retry={finance.reload} />
      ) : (
        finance.data && (
          <>
            {adminMerchantId !== undefined && (
              <p className="text-sm font-semibold text-[#294833]">
                {merchantTierLabels[finance.data.tier.level]} · {feeRateLabel(finance.data.tier.feeRate)} ·
                Doanh thu xét hạng {finance.data.tier.year}: {feeMoney(finance.data.tier.revenueVnd)}
              </p>
            )}
            <PlatformFeeStats summary={finance.data.summary} />
            {finance.data.items.length === 0 ? (
              <EmptyState
                title="Chưa có giao dịch phí"
                description="Không tìm thấy giao dịch phí trong kỳ đã chọn."
              />
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full text-left text-sm" aria-label="Sổ phí bán hàng">
                  <thead className="text-xs muted">
                    <tr className="border-b border-[#e1e9e0]">
                      {["Thời gian", "Mã đơn", "Loại", "Hạng", "Tỷ lệ", "Phí", "Thao tác"].map((heading) => (
                        <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {finance.data.items.map((item) => (
                      <tr key={item.id} className="border-b border-[#edf2eb] last:border-0">
                        <td className="whitespace-nowrap px-4 py-3">{financeDateTime(item.createdAt)}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">#{item.orderId}</td>
                        <td className="whitespace-nowrap px-4 py-3">{feeTypeLabels[item.type]}</td>
                        <td className="px-4 py-3">{merchantTierLabels[item.tier]}</td>
                        <td className="px-4 py-3">{feeRateLabel(item.feeRate)}</td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                          <StatusText tone={item.type === "FEE_REVERSAL" ? "red" : "green"}>
                            {feeMoney(item.amountVnd, true)}
                          </StatusText>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <FeeDetail
                              item={item}
                              loadRelated={() =>
                                loadFees({ orderId: item.orderId }).then((result) => result.items)
                              }
                            />
                            {adminMerchantId === undefined && (
                              <Button asChild variant="ghost" size="sm">
                                <Link to={`/merchant/orders?orderId=${item.orderId}`}>Xem đơn hàng</Link>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
            {(cursors.length > 0 || finance.data.nextCursor !== null) && (
              <nav aria-label="Trang giao dịch phí" className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cursors.length === 0}
                  onClick={() => setCursors((values) => values.slice(0, -1))}
                >
                  Trang trước
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={finance.data.nextCursor === null}
                  onClick={() => {
                    const next = finance.data?.nextCursor;
                    if (next != null) setCursors((values) => [...values, next]);
                  }}
                >
                  Trang sau
                </Button>
              </nav>
            )}
          </>
        )
      )}
    </div>
  );
}

function FeeDetail({
  item,
  loadRelated,
}: {
  item: PlatformFeeItem;
  loadRelated(): Promise<PlatformFeeItem[]>;
}) {
  const feeAmount = BigInt(item.amountVnd);
  const merchantAmount = BigInt(item.orderTotalVnd) - (feeAmount < 0n ? -feeAmount : feeAmount);
  const fields = [
    ["Đơn hàng", `#${item.orderId}`],
    ["Giá trị tính phí", feeMoney(item.orderTotalVnd)],
    ["Hạng áp dụng", merchantTierLabels[item.tier]],
    ["Tỷ lệ áp dụng", feeRateLabel(item.feeRate)],
    ["Phí", feeMoney(item.amountVnd, true)],
    [item.type === "FEE_REVERSAL" ? "Hoàn trừ tiền sau phí" : "Tiền sau phí", feeMoney((item.type === "FEE_REVERSAL" ? -merchantAmount : merchantAmount).toString(), true)],
    ["Phát sinh lúc", financeDateTime(item.createdAt)],
    ["Mã sự kiện", item.eventRef],
  ];
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button type="button" size="sm" variant="outline">
          Chi tiết
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[#14251b]/45" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-[70] max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl p-6 shadow-2xl outline-none">
          <Dialog.Title className="text-xl font-extrabold">
            {feeTypeLabels[item.type]} #{item.id}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Thông tin phí áp dụng cho đơn hàng #{item.orderId}.
          </Dialog.Description>
          <dl className="mt-4 space-y-2 text-sm">
            {fields.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[1fr_1fr] gap-3 border-b border-[#edf2eb] pb-2">
                <dt className="muted">{label}</dt>
                <dd className="break-words text-right font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <RelatedFeeEvents itemId={item.id} load={loadRelated} />
          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild>
              <Button type="button" variant="outline" size="sm">
                Đóng
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RelatedFeeEvents({ itemId, load }: { itemId: number; load(): Promise<PlatformFeeItem[]> }) {
  const related = useResource(load, [itemId]);
  const items = related.data?.filter((entry) => entry.id !== itemId) ?? [];
  return (
    <section aria-label="Giao dịch liên quan" className="mt-4 text-sm">
      <h3 className="font-bold">Giao dịch liên quan</h3>
      {related.loading ? (
        <p className="mt-2 muted" role="status">
          Đang tải…
        </p>
      ) : related.error ? (
        <Button className="mt-2" type="button" variant="outline" size="sm" onClick={related.reload}>
          Thử tải lại giao dịch
        </Button>
      ) : items.length === 0 ? (
        <p className="mt-2 muted">Chưa có giao dịch khác cho đơn này.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((entry) => (
            <li key={entry.id} className="flex flex-wrap justify-between gap-2">
              <span>
                {feeTypeLabels[entry.type]}{" "}
                <span className="text-xs muted">· {financeDateTime(entry.createdAt)}</span>
              </span>
              <StatusText tone={entry.type === "FEE_REVERSAL" ? "red" : "green"}>
                {feeMoney(entry.amountVnd, true)}
              </StatusText>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
