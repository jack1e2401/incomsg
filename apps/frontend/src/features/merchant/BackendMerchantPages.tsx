import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Package, Storefront } from "@phosphor-icons/react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type {
  LoyaltyConfigInput,
  MerchantLoyaltyPreviewResponse,
  OrderDto,
  OrderStatus,
  ProductDto,
  ProductPatch,
  TierLevel,
  VoucherDefinitionDto,
  VoucherDefinitionInput,
} from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { LoyaltyFormula } from "../../components/LoyaltyFormula";
import {
  StatusText,
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatCard,
  Textarea,
} from "../../components/ui";
import { money } from "../../lib/utils";
import { MerchantRevenueChart } from "./MerchantRevenueChart";
import { MerchantFinanceOverview } from "../finance/MerchantFinanceOverview";
import { PlatformFeeLedger } from "../finance/PlatformFeeLedger";
import { MerchantStoreDetails } from "./MerchantStoreDetails";
import { MerchantLoyaltyTransactions } from "./MerchantLoyaltyTransactions";
import { MerchantRefundDialog } from "./MerchantRefundDialog";
import { MerchantAbuseReportDialog } from "./MerchantAbuseReportDialog";
import { MerchantRewardQueue } from "./MerchantRewardQueue";
import { MerchantProductTableRow } from "./MerchantProductTableRow";
import { MerchantVoucherTableRow } from "./MerchantVoucherTableRow";
import { MerchantLoyaltyHistory } from "./MerchantLoyaltyHistory";
import { MerchantLoyaltyMembers } from "./MerchantLoyaltyMembers";
import { OrderLoyaltyPolicySnapshot } from "../orders/OrderLoyaltyPolicySnapshot";

export { MerchantLoyaltyTransactions } from "./MerchantLoyaltyTransactions";
export { MerchantRefundDialog } from "./MerchantRefundDialog";
export { MerchantAbuseReportDialog } from "./MerchantAbuseReportDialog";
export { MerchantRewardQueue } from "./MerchantRewardQueue";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function useToken() {
  const { accessToken } = useAuthSession();
  if (!accessToken) throw new Error("Phiên đăng nhập đã hết hạn");
  return accessToken;
}

function message(reason: unknown) {
  return reason instanceof Error ? reason.message : "Yêu cầu thất bại";
}

function formatPrice(value: string) {
  return money(Number(value));
}

function orderStatusTone(status: OrderStatus): "green" | "amber" | "neutral" | "red" | "purple" {
  switch (status) {
    case "PAID":
      return "green";
    case "PENDING":
    case "REFUND_PENDING":
      return "amber";
    case "REFUNDED":
      return "purple";
    case "FAILED":
      return "red";
    case "CANCELLED":
    default:
      return "neutral";
  }
}

function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "PAID":
      return "Đã thanh toán";
    case "PENDING":
      return "Chờ thanh toán";
    case "REFUND_PENDING":
      return "Đang hoàn tiền";
    case "REFUNDED":
      return "Đã hoàn tiền";
    case "FAILED":
      return "Thất bại";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return status;
  }
}

export function MerchantOverview() {
  const token = useToken();
  const store = useResource(() => api.getOwnMerchant(token), [token]);
  const products = useResource(() => api.listOwnProducts(token), [token]);
  const orders = useResource(
    () => api.listMerchantOrders(token).then((response) => response.orders),
    [token],
  );
  if (store.loading || products.loading) return <LoadingState cards={3} />;
  if (store.error || products.error)
    return (
      <ErrorState
        message={store.error ?? products.error ?? "Lỗi tải cửa hàng"}
        retry={() => {
          store.reload();
          products.reload();
        }}
      />
    );
  const merchant = store.data?.merchant;
  if (!merchant)
    return (
      <EmptyState
        title="Chưa có cửa hàng"
        description="Cửa hàng chỉ hoạt động sau khi Admin duyệt hồ sơ Merchant."
      />
    );
  return (
    <>
      <PageHeader
        title={merchant.name}
        description={`Mã cửa hàng #${merchant.id}`}
        action={
          <Button asChild>
            <Link to="/merchant/products">
              Quản lý sản phẩm <ArrowRight size={16} />
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Sản phẩm" value={products.data?.products.length ?? 0} icon={<Package size={20} />} />
        <StatCard
          label="Đang hiển thị"
          value={
            products.data?.products.filter((item) => item.status === "ACTIVE" && item.kind !== "REWARD")
              .length ?? 0
          }
          icon={<Storefront size={20} />}
        />
        <StatCard label="Trạng thái cửa hàng" value={merchant.isActive ? "Hoạt động" : "Không hoạt động"} />
      </div>
      <MerchantRevenueChart
        orders={orders.data}
        loading={orders.loading}
        error={orders.error}
        retry={orders.reload}
      />
      <MerchantFinanceOverview token={token} />
    </>
  );
}

export function MerchantStore() {
  const token = useToken();
  const resource = useResource(() => api.getOwnMerchant(token), [token]);
  return (
    <>
      <PageHeader title="Cửa hàng" />
      {resource.loading ? (
        <LoadingState cards={1} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : resource.data?.merchant ? (
        <MerchantStoreDetails merchant={resource.data.merchant} token={token} />
      ) : (
        <EmptyState
          title="Chưa có cửa hàng"
          description="Cửa hàng chỉ hoạt động sau khi Admin duyệt hồ sơ Merchant."
        />
      )}
    </>
  );
}

type ProductForm = {
  kind: ProductDto["kind"];
  name: string;
  price: string;
  description: string;
  imageUrl: string;
  status: ProductDto["status"];
  initialQuantity: string;
};
const emptyProduct: ProductForm = {
  kind: "SALE",
  name: "",
  price: "",
  description: "",
  imageUrl: "",
  status: "ACTIVE",
  initialQuantity: "0",
};

export function MerchantProducts() {
  const token = useToken();
  const resource = useResource(() => api.listOwnProducts(token), [token]);
  const [editing, setEditing] = useState<ProductDto | "new" | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProduct);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function open(product?: ProductDto) {
    setEditing(product ?? "new");
    setForm(
      product
        ? {
            kind: product.kind ?? "SALE",
            name: product.name,
            price: product.price,
            description: product.description ?? "",
            imageUrl: product.imageUrl ?? "",
            status: product.status,
            initialQuantity: "0",
          }
        : emptyProduct,
    );
    setError("");
    setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !editing) return;
    setError("");
    setBusy(true);
    try {
      const fields = {
        name: form.name.trim(),
        description: form.description || null,
        imageUrl: form.imageUrl || null,
      };
      const result =
        editing === "new"
          ? await api.createProduct(
              form.kind === "REWARD"
                ? { ...fields, kind: "REWARD", initialQuantity: Number(form.initialQuantity) }
                : { ...fields, price: form.price.trim(), initialQuantity: Number(form.initialQuantity) },
              token,
            )
          : await api.updateProduct(
              editing.id,
              {
                ...fields,
                ...(form.kind === "SALE" ? { price: form.price.trim() } : {}),
                status: form.status,
              },
              token,
            );
      resource.setData((previous) =>
        previous
          ? {
              products:
                editing === "new"
                  ? [...previous.products, result.product]
                  : previous.products.map((item) => (item.id === result.product.id ? result.product : item)),
            }
          : { products: [result.product] },
      );
      setNotice("Đã lưu sản phẩm.");
      setEditing(null);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(product: ProductDto) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const patch: ProductPatch = { status: product.status === "ACTIVE" ? "HIDDEN" : "ACTIVE" };
      const result = await api.updateProduct(product.id, patch, token);
      resource.setData((previous) =>
        previous
          ? { products: previous.products.map((item) => (item.id === product.id ? result.product : item)) }
          : previous,
      );
      setNotice("Đã cập nhật trạng thái sản phẩm.");
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Sản phẩm" action={<Button onClick={() => open()}>Thêm sản phẩm</Button>} />
      {notice && (
        <p role="status" className="mb-4 rounded-xl bg-[#e1f2df] p-4 text-sm text-[#357044]">
          {notice}
        </p>
      )}
      {error && !editing && (
        <p role="alert" className="mb-4 rounded-xl bg-[#fae7e3] p-4 text-sm text-[#a4473a]">
          {error}
        </p>
      )}
      <Dialog.Root open={editing !== null} onOpenChange={(open) => !open && !busy && setEditing(null)}>
        {editing && <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
          <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl p-6 shadow-2xl outline-none sm:p-8">
          <Dialog.Title className="text-lg font-extrabold">
            {editing === "new" ? "Thêm sản phẩm" : `Sửa sản phẩm #${editing.id}`}
          </Dialog.Title>
          <Dialog.Description className="sr-only">Nhập thông tin sản phẩm và lưu thay đổi.</Dialog.Description>
          <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Loại sản phẩm">
              <Select
                disabled={editing !== "new" || busy}
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value as ProductDto["kind"] })}
              >
                <option value="SALE">Sản phẩm bán</option>
                <option value="REWARD">Chỉ đổi thưởng</option>
              </Select>
            </Field>
            <Field label="Tên sản phẩm">
              <Input
                required
                maxLength={191}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            {form.kind === "SALE" && (
              <Field label="Giá (VND)">
                <Input
                  required
                  inputMode="numeric"
                  pattern="[1-9][0-9]{0,14}"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                />
              </Field>
            )}
            {editing === "new" && (
              <Field label="Số lượng ban đầu">
                <Input required type="number" min={0} max={2147483647} step={1} value={form.initialQuantity} onChange={(event) => setForm({ ...form, initialQuantity: event.target.value })} />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field label="Mô tả">
                <Textarea
                  maxLength={1000}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="URL hình ảnh">
                <Input
                  type="url"
                  maxLength={2048}
                  value={form.imageUrl}
                  onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
                />
              </Field>
            </div>
            {editing !== "new" && (
              <Field label="Trạng thái">
                <Select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as ProductDto["status"] })
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="HIDDEN">HIDDEN</option>
                </Select>
              </Field>
            )}
            {error && (
              <p role="alert" className="sm:col-span-2 text-sm text-[#a4473a]">
                {error}
              </p>
            )}
            <div className="flex gap-3 sm:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu sản phẩm"}
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)}>
                Hủy
              </Button>
            </div>
          </form>
          </Dialog.Content>
        </Dialog.Portal>}
      </Dialog.Root>
      {resource.loading ? (
        <LoadingState cards={3} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.products.length ? (
        <EmptyState
          title="Chưa có sản phẩm"
          description="Thêm sản phẩm để bán hoặc dùng làm quà đổi thưởng."
        />
      ) : (
        <div className="surface overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[9%]" />
              <col className="w-[12%]" />
              <col className="w-[32%]" />
              <col className="w-[14%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="bg-[#f7f9f5] text-xs font-bold uppercase tracking-wide text-[#65746a]">
              <tr>
                <th scope="col" className="px-5 py-4">Sản phẩm</th>
                <th scope="col" className="px-4 py-4">Nhóm</th>
                <th scope="col" className="px-4 py-4">Giá</th>
                <th scope="col" className="px-4 py-4">Tồn kho</th>
                <th scope="col" className="px-4 py-4">Trạng thái</th>
                <th scope="col" className="px-4 py-4"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {resource.data.products.map((product) => (
                <MerchantProductTableRow
                  key={product.id}
                  product={product}
                  token={token}
                  onEdit={() => open(product)}
                  onStatusChange={() => void changeStatus(product)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function MerchantOrders() {
  const token = useToken();
  const [params, setParams] = useSearchParams();
  const showFees = params.get("tab") === "fees";
  const orderId = Number(params.get("orderId"));
  const selectedOrderId = Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
  const voucherId = Number(params.get("voucherId"));
  const selectedVoucherId = Number.isSafeInteger(voucherId) && voucherId > 0 ? voucherId : null;
  return (
    <>
      <PageHeader title="Đơn hàng" />
      <div className="mb-5 flex flex-wrap gap-2" aria-label="Chế độ xem đơn hàng">
        <Button type="button" size="sm" variant={showFees ? "outline" : "default"} aria-pressed={!showFees} onClick={() => setParams({})}>Đơn mua và quà đổi thưởng</Button>
        <Button type="button" size="sm" variant={showFees ? "default" : "outline"} aria-pressed={showFees} onClick={() => setParams({ tab: "fees" })}>Sổ phí bán hàng</Button>
      </div>
      {showFees ? <PlatformFeeLedger token={token} /> :
      <div className="space-y-8">
        {selectedOrderId === null && <section aria-labelledby="merchant-order-rewards">
          <h2 id="merchant-order-rewards" className="mb-3 text-lg font-extrabold">
            Quà đổi thưởng
          </h2>
          {selectedVoucherId !== null && <Button type="button" size="sm" variant="outline" className="mb-3" onClick={() => setParams({})}>Tất cả quà đổi thưởng</Button>}
          <MerchantRewardQueue key={selectedVoucherId ?? "all"} voucherId={selectedVoucherId ?? undefined} />
        </section>}
        {selectedVoucherId === null && <section aria-labelledby="merchant-purchase-orders">
          <h2 id="merchant-purchase-orders" className="mb-3 text-lg font-extrabold">
            Đơn mua hàng
          </h2>
          {selectedOrderId !== null && (
            <div className="mb-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setParams({ tab: "fees" })}>Về sổ phí</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setParams({})}>Tất cả đơn hàng</Button>
            </div>
          )}
          <MerchantPurchaseOrders key={selectedOrderId ?? "all"} orderId={selectedOrderId} />
        </section>}
      </div>}
    </>
  );
}

function MerchantPurchaseOrders({ orderId }: { orderId: number | null }) {
  const token = useToken();
  const resource = useResource<(OrderDto & { memberEmail?: string })[]>(
    () => orderId === null ? api.listMerchantOrders(token).then(({ orders }) => orders) : api.getMerchantOrder(orderId, token).then(({ order }) => [order]),
    [token, orderId],
  );
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState<OrderDto | null>(null);
  const [selectedOrderForReport, setSelectedOrderForReport] = useState<(OrderDto & { memberEmail?: string }) | null>(null);
  const [policyOrderId, setPolicyOrderId] = useState<number | null>(null);
  const policyOrder = useResource(
    () => policyOrderId === null ? Promise.resolve(null) : api.getMerchantOrder(policyOrderId, token).then(({ order }) => order),
    [policyOrderId, token],
  );
  const [notice, setNotice] = useState("");

  return (
    <>
      {notice && (
        <p role="status" className="mb-4 text-sm text-[#357044]">
          {notice}
        </p>
      )}
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState
          title="Chưa có đơn hàng"
          description="Đơn của Member sẽ xuất hiện sau khi được tạo tại cửa hàng này."
        />
      ) : (
        <div className="space-y-3">
          {resource.data.map((order) => {
            const canRefund = order.actions?.canRefund === true;
            return (
              <Card key={order.id} className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-extrabold">Đơn #{order.id}</h3>
                    <StatusText tone={orderStatusTone(order.status)}>
                      {orderStatusLabel(order.status)}
                    </StatusText>
                    {order.refundStatus === "PENDING_PROVIDER" && (
                      <StatusText tone="amber">Chờ cổng xác nhận hoàn tiền</StatusText>
                    )}
                    {order.refundStatus === "COMPLETED" && order.status !== "REFUNDED" && (
                      <StatusText tone="purple">Đã hoàn tiền</StatusText>
                    )}
                  </div>
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-[#53685a]">
                    <span className="font-semibold text-[#294833]">Thành viên #{order.memberId}</span>
                    {order.memberEmail && <span className="min-w-0 wrap-anywhere">{order.memberEmail}</span>}
                  </p>
                  <p className="mt-2 text-xs muted">
                    {order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ")}
                  </p>
                  {order.paidAt && (
                    <p className="mt-1 text-xs muted">
                      Thanh toán {new Date(order.paidAt).toLocaleString("vi-VN")}
                    </p>
                  )}
                </div>
                <div className="text-left sm:text-right">
                  {Number(order.discountAmount) > 0 ? (
                    <dl className="space-y-1 tabular-nums sm:min-w-52">
                      <div className="flex flex-wrap justify-between gap-x-4 text-xs muted">
                        <dt>Tạm tính</dt>
                        <dd>{formatPrice(order.subtotal)}</dd>
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-4 text-xs muted">
                        <dt>Voucher giảm giá</dt>
                        <dd>−{formatPrice(order.discountAmount)}</dd>
                      </div>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <dt className="text-xs muted">Tổng cộng</dt>
                        <dd className="text-lg font-extrabold">{formatPrice(order.total)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-lg font-extrabold">{formatPrice(order.total)}</p>
                  )}
                  {order.status === "PAID" &&
                    (order.earnedPointsExact != null || order.earnedPoints != null) && (
                      <p className="mt-1 text-xs font-semibold text-[#357044]">
                        +{order.earnedPointsExact ?? order.earnedPoints?.toLocaleString("vi-VN")} điểm
                      </p>
                    )}
                  <div className="mt-3 flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                    {order.paidAt && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setPolicyOrderId(policyOrderId === order.id ? null : order.id)}>
                        {policyOrderId === order.id ? "Ẩn chính sách" : "Chính sách đã áp dụng"}
                      </Button>
                    )}
                    {canRefund && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrderForRefund(order)}
                      >
                        Hoàn tiền
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOrderForReport(order)}
                    >
                      Báo cáo vi phạm
                    </Button>
                  </div>
                </div>
                {policyOrderId === order.id && (
                  <div className="sm:col-span-2">
                    {policyOrder.loading ? <p className="text-sm muted">Đang tải chính sách…</p> : policyOrder.error ? <p role="alert" className="text-sm text-[#a4473a]">{policyOrder.error}</p> : <OrderLoyaltyPolicySnapshot policy={policyOrder.data?.appliedLoyaltyPolicy ?? null} />}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <MerchantRefundDialog
        order={selectedOrderForRefund}
        onClose={() => setSelectedOrderForRefund(null)}
        onRefundCompleted={(updatedOrder, msg) => {
          resource.setData((current) =>
            (current ?? []).map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o)),
          );
          setNotice(msg);
        }}
      />

      <MerchantAbuseReportDialog
        order={selectedOrderForReport}
        onClose={() => setSelectedOrderForReport(null)}
        onReportSubmitted={(_report, msg) => {
          setNotice(msg);
        }}
      />
    </>
  );
}

export function MerchantVouchers() {
  const token = useToken();
  const resource = useResource(
    () => api.listMerchantVoucherDefinitions(token).then((response) => response.definitions),
    [token],
  );
  const [kind, setKind] = useState<VoucherDefinitionInput["type"] | "">("");
  const [title, setTitle] = useState("");
  const [pointsCost, setPointsCost] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [rewardProductId, setRewardProductId] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isReward = kind === "REWARD";
  const rewardProducts = useResource(
    () =>
      isReward
        ? api
            .listOwnProducts(token)
            .then(({ products }) =>
              products.filter((product) => product.kind === "REWARD" && product.status === "ACTIVE"),
            )
        : Promise.resolve([]),
    [token, isReward],
  );
  const selectedReward =
    rewardProducts.loading || rewardProducts.error
      ? undefined
      : rewardProducts.data?.find((product) => String(product.id) === rewardProductId);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kind || busy || (isReward && !selectedReward)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const terms = { title: title.trim(), pointsCost: Number(pointsCost) };
      const input: VoucherDefinitionInput =
        kind === "REWARD"
          ? { ...terms, type: kind, discountAmount: null, rewardProductId: Number(rewardProductId) }
          : { ...terms, type: kind, discountAmount, initialQuantity: Number(initialQuantity), rewardDescription: null };
      const response = await api.createVoucherDefinition(input, token);
      resource.setData((current) => [...(current ?? []), response.definition]);
      setKind("");
      setTitle("");
      setPointsCost("");
      setDiscountAmount("");
      setInitialQuantity("0");
      setRewardProductId("");
      setNotice("Đã tạo voucher.");
    } catch (reason) {
      const failure = message(reason);
      if (failure === "REWARD_PRODUCT_NOT_FOUND") {
        setError("Sản phẩm đổi thưởng không còn khả dụng. Hãy chọn sản phẩm khác.");
        setRewardProductId("");
        rewardProducts.reload();
      } else {
        setError(failure);
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggle(definition: VoucherDefinitionDto) {
    if (busyId !== null) return;
    setBusyId(definition.id);
    setError("");
    setNotice("");
    try {
      const response = await api.updateVoucherDefinition(
        definition.id,
        { isActive: !definition.isActive },
        token,
      );
      updateDefinition(response.definition);
      setNotice("Đã cập nhật voucher.");
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusyId(null);
    }
  }

  function updateDefinition(definition: VoucherDefinitionDto) {
    resource.setData((current) => current?.map((item) => item.id === definition.id ? definition : item) ?? null);
  }

  return (
    <>
      <PageHeader title="Voucher" />
      <Card className="mb-6 max-w-3xl p-6 sm:p-8">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={create}>
          <Field label="Loại voucher">
            <Select
              required
              disabled={busy}
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
            >
              <option value="" disabled>
                Chọn loại voucher
              </option>
              <option value="DISCOUNT">Giảm giá</option>
              <option value="REWARD">Quà tặng</option>
            </Select>
          </Field>
          {kind && (
            <>
              <Field label="Tên voucher">
                <Input
                  required
                  maxLength={191}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
              <Field label="Điểm cần đổi">
                <Input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={pointsCost}
                  onChange={(event) => setPointsCost(event.target.value)}
                />
              </Field>
              {kind === "DISCOUNT" ? (
                <>
                  <Field label="Số tiền giảm (VND)">
                    <Input
                      required
                      inputMode="numeric"
                      pattern="[1-9][0-9]{0,14}"
                      value={discountAmount}
                      onChange={(event) => setDiscountAmount(event.target.value)}
                    />
                  </Field>
                  <Field label="Số lượt phát hành ban đầu">
                    <Input required type="number" min={0} max={2147483647} step={1} value={initialQuantity} onChange={(event) => setInitialQuantity(event.target.value)} />
                  </Field>
                </>
              ) : (
                <div>
                  <Field label="Sản phẩm đổi thưởng">
                    <Select
                      required
                      disabled={
                        busy ||
                        rewardProducts.loading ||
                        !!rewardProducts.error ||
                        !rewardProducts.data?.length
                      }
                      value={selectedReward ? rewardProductId : ""}
                      onChange={(event) => setRewardProductId(event.target.value)}
                    >
                      <option value="" disabled>
                        {rewardProducts.loading ? "Đang tải sản phẩm…" : "Chọn sản phẩm"}
                      </option>
                      {rewardProducts.data?.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · #{product.id}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {rewardProducts.error ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p role="alert" className="text-xs text-[#a4473a]">
                        Không tải được sản phẩm đổi thưởng.
                      </p>
                      <Button type="button" size="sm" variant="outline" onClick={rewardProducts.reload}>
                        Thử lại
                      </Button>
                    </div>
                  ) : !rewardProducts.loading && !rewardProducts.data?.length ? (
                    <p className="mt-2 text-xs muted">
                      Chưa có sản phẩm chỉ đổi thưởng đang hoạt động.{" "}
                      <Link to="/merchant/products" className="underline">
                        Quản lý sản phẩm
                      </Link>
                    </p>
                  ) : null}
                </div>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="sm:col-span-2 text-sm text-[#a4473a]">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="sm:col-span-2 text-sm text-[#357044]">
              {notice}
            </p>
          )}
          {kind && (
            <div className="sm:col-span-2">
              <Button disabled={busy || (isReward && !selectedReward)}>
                {busy ? <BusyLabel>Đang lưu</BusyLabel> : "Tạo voucher"}
              </Button>
            </div>
          )}
        </form>
      </Card>
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState
          title="Chưa có voucher"
          description="Tạo voucher đầu tiên cho chương trình của cửa hàng."
        />
      ) : (
        <div className="surface overflow-x-auto rounded-3xl">
          <table aria-label="Danh sách voucher" className="w-full min-w-[760px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[23%]" />
              <col className="w-[16%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="bg-[#f7f9f5] text-xs font-bold uppercase tracking-wide text-[#65746a]">
              <tr>
                <th scope="col" className="px-5 py-4">Voucher</th>
                <th scope="col" className="px-4 py-4">Loại</th>
                <th scope="col" className="px-4 py-4">Điểm đổi</th>
                <th scope="col" className="px-4 py-4">Số lượng</th>
                <th scope="col" className="px-4 py-4">Trạng thái</th>
                <th scope="col" className="px-4 py-4"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {resource.data.map((definition) => (
                <MerchantVoucherTableRow
                  key={definition.id}
                  definition={definition}
                  token={token}
                  statusBusy={busyId !== null}
                  onToggle={() => void toggle(definition)}
                  onDefinitionChange={updateDefinition}
                  onInventoryChange={(availableQuantity) => resource.setData((current) =>
                    current?.map((item) => item.id === definition.id ? { ...item, availableQuantity } : item) ?? null,
                  )}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function MerchantLoyalty() {
  const token = useToken();
  const resource = useResource(() => api.getLoyaltyConfig(token), [token]);
  const history = useResource(() => api.getLoyaltyPolicyHistory(token), [token]);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab");
  const activeTab = tab === "ledger" || tab === "history" || tab === "members" ? tab : "config";
  const [draft, setDraft] = useState<LoyaltyConfigInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Formula preview state
  const [previewAmount, setPreviewAmount] = useState("");
  const [previewTier, setPreviewTier] = useState<TierLevel | "">("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewResult, setPreviewResult] = useState<MerchantLoyaltyPreviewResponse | null>(null);

  const config = resource.data?.config;
  const form =
    draft ??
    (config
      ? {
          vndPerPoint: config.vndPerPoint,
          isActive: config.isActive,
          tiers: config.tiers.map((tier) => ({ ...tier })),
        }
      : null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.putLoyaltyConfig(form, token);
      resource.setData(result);
      history.reload();
      setDraft(null);
      setNotice("Đã lưu cấu hình.");
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  async function runFormulaPreview() {
    if (!previewAmount || previewBusy) return;
    setPreviewBusy(true);
    setPreviewError("");
    try {
      const result = await api.previewMerchantLoyalty(
        {
          netOrderAmountVnd: previewAmount,
          ...(previewTier ? { tierLevel: previewTier } : {}),
        },
        token,
      );
      setPreviewResult(result);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Không thể tính thử điểm");
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Cấu hình Loyalty" />
      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={activeTab === "config" ? "default" : "outline"}
          aria-pressed={activeTab === "config"}
          onClick={() => setParams({})}
        >
          Cấu hình quy tắc
        </Button>
        <Button
          type="button"
          size="sm"
          variant={activeTab === "ledger" ? "default" : "outline"}
          aria-pressed={activeTab === "ledger"}
          onClick={() => setParams({ tab: "ledger" })}
        >
          Lịch sử giao dịch điểm
        </Button>
        <Button
          type="button"
          size="sm"
          variant={activeTab === "history" ? "default" : "outline"}
          aria-pressed={activeTab === "history"}
          onClick={() => setParams({ tab: "history" })}
        >
          Lịch sử chính sách
        </Button>
        <Button type="button" size="sm" variant={activeTab === "members" ? "default" : "outline"} aria-pressed={activeTab === "members"} onClick={() => setParams({ tab: "members" })}>
          Thành viên
        </Button>
      </div>

      {activeTab === "config" ? (
        resource.loading ? (
          <LoadingState cards={2} />
        ) : resource.error ? (
          <ErrorState message={resource.error} retry={resource.reload} />
        ) : !config || !form ? (
          <EmptyState title="Chưa có cấu hình" description="Cấu hình chưa khả dụng." />
        ) : (
          <div className="space-y-6 max-w-4xl">
            <div className="rounded-2xl bg-[#fff8eb] p-4 text-xs leading-5 text-[#97682a]">
              <p className="font-bold">
                Lưu ý: Thay đổi tỷ lệ hoặc hạng tích điểm chỉ áp dụng cho các đơn hàng phát sinh sau này.
              </p>
              <p className="mt-1">
                Số dư điểm hiện tại và phần điểm lẻ của hội viên sẽ được bảo lưu nguyên vẹn.
              </p>
            </div>

            <Card className="p-6 sm:p-8">
              <LoyaltyFormula config={config} />
              <form onSubmit={save} className="mt-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="VND cho mỗi điểm">
                    <Input
                      required
                      type="number"
                      min={1}
                      step={1}
                      value={form.vndPerPoint}
                      onChange={(event) => setDraft({ ...form, vndPerPoint: Number(event.target.value) })}
                    />
                  </Field>
                  <Field label="Quy tắc tích điểm">
                    <Select
                      value={form.isActive ? "true" : "false"}
                      onChange={(event) => setDraft({ ...form, isActive: event.target.value === "true" })}
                    >
                      <option value="true">Hoạt động</option>
                      <option value="false">Tạm dừng</option>
                    </Select>
                  </Field>
                </div>
                <div>
                  <h2 className="font-extrabold">Các hạng</h2>
                  <p className="mt-1 text-xs muted">
                    Ngưỡng Bronze cố định ở 0. Nhập ngưỡng tăng dần và hệ số ở dạng 1.00.
                  </p>
                  <div className="mt-4 space-y-3">
                    {form.tiers.map((tier, index) => (
                      <div
                        key={tier.level}
                        className="grid items-end gap-3 rounded-xl bg-[#f7f9f5] p-4 sm:grid-cols-[1fr_1fr_1fr]"
                      >
                        <p className="pb-3 text-sm font-extrabold">{tier.level}</p>
                        <Field label="Điểm tích lũy tối thiểu">
                          <Input
                            required
                            type="number"
                            min={index === 0 ? 0 : 1}
                            step={1}
                            disabled={index === 0}
                            value={tier.minLifetimePoints}
                            onChange={(event) =>
                              setDraft({
                                ...form,
                                tiers: form.tiers.map((item, i) =>
                                  i === index
                                    ? { ...item, minLifetimePoints: Number(event.target.value) }
                                    : item,
                                ),
                              })
                            }
                          />
                        </Field>
                        <Field label="Hệ số">
                          <Input
                            required
                            pattern="[0-9]{1,3}\.[0-9]{2}"
                            value={tier.multiplier}
                            onChange={(event) =>
                              setDraft({
                                ...form,
                                tiers: form.tiers.map((item, i) =>
                                  i === index ? { ...item, multiplier: event.target.value } : item,
                                ),
                              })
                            }
                          />
                        </Field>
                      </div>
                    ))}
                  </div>
                </div>
                {error && (
                  <p role="alert" className="text-sm text-[#a4473a]">
                    {error}
                  </p>
                )}
                {notice && (
                  <p role="status" className="text-sm text-[#357044]">
                    {notice}
                  </p>
                )}
                <Button disabled={busy}>{busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu cấu hình"}</Button>
              </form>
            </Card>

            <Card className="p-6 sm:p-8">
              <h2 className="text-lg font-extrabold">Xem trước công thức tích điểm</h2>
              <p className="mt-1 text-xs muted">
                Thử tính toán điểm số cho đơn hàng dựa trên công thức hiện tại mà không thay đổi dữ liệu.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Số tiền đơn hàng thử nghiệm (VNĐ)">
                  <Input
                    required
                    type="number"
                    min={1}
                    aria-label="Số tiền đơn hàng thử nghiệm"
                    value={previewAmount}
                    onChange={(event) => setPreviewAmount(event.target.value)}
                    placeholder="50000"
                  />
                </Field>
                <Field label="Hạng thành viên (tùy chọn)">
                  <Select
                    value={previewTier}
                    onChange={(event) => setPreviewTier(event.target.value as TierLevel | "")}
                  >
                    <option value="">Theo cấu hình</option>
                    <option value="BRONZE">BRONZE</option>
                    <option value="SILVER">SILVER</option>
                    <option value="GOLD">GOLD</option>
                    <option value="PLATINUM">PLATINUM</option>
                  </Select>
                </Field>
                <div className="flex items-end">
                  <Button
                    type="button"
                    disabled={previewBusy || !previewAmount}
                    onClick={() => void runFormulaPreview()}
                  >
                    {previewBusy ? <BusyLabel>Đang tính</BusyLabel> : "Tính thử điểm"}
                  </Button>
                </div>
              </div>

              {previewError && (
                <p role="alert" className="mt-3 text-xs text-[#a4473a]">
                  {previewError}
                </p>
              )}

              {previewResult && (
                <div className="mt-4 rounded-xl bg-[#edf4e9] p-4 text-xs">
                  <p className="text-sm font-bold text-[#294833]">
                    Điểm ước tính:{" "}
                    <span className="font-mono text-base">{previewResult.estimatedPointsExact}</span> điểm
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[#46614d] sm:grid-cols-4">
                    <p>
                      Phần nguyên: <b>{previewResult.integerProjection}</b>
                    </p>
                    <p>
                      Phần lẻ: <b>{previewResult.fractionalProjection}</b>
                    </p>
                    <p>
                      Hệ số: <b>{previewResult.multiplier}×</b>
                    </p>
                    <p>
                      Tỷ lệ: <b>{formatPrice(String(previewResult.vndPerPoint))}/điểm</b>
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] text-[#637269]">
                    Làm tròn: {previewResult.rounding} · Độ chính xác: {previewResult.scale} chữ số thập phân
                  </p>
                </div>
              )}
            </Card>
          </div>
        )
      ) : activeTab === "ledger" ? (
        <MerchantLoyaltyTransactions />
      ) : activeTab === "members" ? (
        <MerchantLoyaltyMembers token={token} memberId={params.get("memberId")} />
      ) : history.loading ? (
        <LoadingState cards={2} />
      ) : history.error ? (
        <ErrorState message={history.error} retry={history.reload} />
      ) : (
        <Card className="max-w-4xl p-5 sm:p-7"><MerchantLoyaltyHistory versions={history.data?.versions ?? []} /></Card>
      )}
    </>
  );
}
