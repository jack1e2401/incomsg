import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Package, Storefront } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type {
  LoyaltyConfigInput,
  ProductDto,
  ProductInput,
  ProductPatch,
  VoucherDefinitionDto,
  VoucherDefinitionInput,
} from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
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

function MissingEndpoint({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState title="Chưa khả dụng" description="Tính năng này chưa được hỗ trợ." />
    </>
  );
}

export function MerchantOverview() {
  const token = useToken();
  const store = useResource(() => api.getOwnMerchant(token), [token]);
  const products = useResource(() => api.listOwnProducts(token), [token]);
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
          value={products.data?.products.filter((item) => item.status === "ACTIVE").length ?? 0}
          icon={<Storefront size={20} />}
        />
        <StatCard label="Trạng thái cửa hàng" value={merchant.isActive ? "Hoạt động" : "Không hoạt động"} />
      </div>
      <Card className="mt-5 p-6">
        <h2 className="font-bold">Thông tin cửa hàng</h2>
        <p className="mt-2 text-sm muted">Mã cửa hàng: #{merchant.id}</p>
      </Card>
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
        <Card className="max-w-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold">{resource.data.merchant.name}</h2>
            <StatusText tone={resource.data.merchant.isActive ? "green" : "amber"}>
              {resource.data.merchant.isActive ? "Hoạt động" : "Không hoạt động"}
            </StatusText>
          </div>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="muted">Merchant ID</dt>
              <dd className="mt-1 font-bold">#{resource.data.merchant.id}</dd>
            </div>
          </dl>
        </Card>
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
  name: string;
  price: string;
  description: string;
  imageUrl: string;
  status: ProductDto["status"];
};
const emptyProduct: ProductForm = { name: "", price: "", description: "", imageUrl: "", status: "ACTIVE" };

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
            name: product.name,
            price: product.price,
            description: product.description ?? "",
            imageUrl: product.imageUrl ?? "",
            status: product.status,
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
      const input: ProductInput = {
        name: form.name.trim(),
        price: form.price.trim(),
        description: form.description || null,
        imageUrl: form.imageUrl || null,
      };
      const result =
        editing === "new"
          ? await api.createProduct(input, token)
          : await api.updateProduct(editing.id, { ...input, status: form.status }, token);
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
      {editing && (
        <Card className="mb-6 p-6 sm:p-8">
          <h2 className="text-lg font-extrabold">
            {editing === "new" ? "Thêm sản phẩm" : `Sửa sản phẩm #${editing.id}`}
          </h2>
          <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Tên sản phẩm">
              <Input
                required
                maxLength={191}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Giá (VND)">
              <Input
                required
                inputMode="numeric"
                pattern="[1-9][0-9]{0,14}"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
              />
            </Field>
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
        </Card>
      )}
      {resource.loading ? (
        <LoadingState cards={3} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.products.length ? (
        <EmptyState
          title="Chưa có sản phẩm"
          description="Thêm sản phẩm đầu tiên để hiển thị trong gian hàng."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {resource.data.products.map((product) => (
            <Card key={product.id} className="overflow-hidden p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="mt-1 font-extrabold">{product.name}</h2>
                </div>
                <StatusText tone={product.status === "ACTIVE" ? "green" : "amber"}>
                  {product.status === "ACTIVE" ? "Đang bán" : "Đã ẩn"}
                </StatusText>
              </div>
              <p className="mt-3 text-lg font-extrabold text-[#335e3d]">{formatPrice(product.price)}</p>
              {product.description && (
                <p className="mt-2 line-clamp-2 text-sm muted">{product.description}</p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => open(product)}>
                  Chỉnh sửa
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => changeStatus(product)}>
                  {product.status === "ACTIVE" ? "Ẩn" : "Hiển thị"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function MerchantOrders() {
  return <MissingEndpoint title="Đơn hàng" />;
}
export function MerchantVouchers() {
  const token = useToken();
  const resource = useResource(
    () => api.listMerchantVoucherDefinitions(token).then((response) => response.definitions),
    [token],
  );
  const [kind, setKind] = useState<VoucherDefinitionInput["type"]>("DISCOUNT");
  const [title, setTitle] = useState("");
  const [pointsCost, setPointsCost] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [rewardDescription, setRewardDescription] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const input: VoucherDefinitionInput = {
        type: kind,
        title: title.trim(),
        pointsCost: Number(pointsCost),
        discountAmount: kind === "DISCOUNT" ? discountAmount : null,
        rewardDescription: kind === "REWARD" ? rewardDescription.trim() : null,
      };
      const response = await api.createVoucherDefinition(input, token);
      resource.setData((current) => [...(current ?? []), response.definition]);
      setTitle("");
      setPointsCost("");
      setDiscountAmount("");
      setRewardDescription("");
      setNotice("Đã tạo voucher.");
    } catch (reason) {
      setError(message(reason));
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
      resource.setData((current) =>
        (current ?? []).map((item) => (item.id === response.definition.id ? response.definition : item)),
      );
      setNotice("Đã cập nhật voucher.");
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Voucher" description="Tạo mẫu giảm giá hoặc quà tặng theo điểm của cửa hàng." />
      <Card className="mb-6 max-w-3xl p-6 sm:p-8">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={create}>
          <Field label="Loại voucher">
            <Select
              value={kind}
              onChange={(event) => setKind(event.target.value as VoucherDefinitionInput["type"])}
            >
              <option value="DISCOUNT">DISCOUNT · Giảm giá</option>
              <option value="REWARD">REWARD · Quà tặng</option>
            </Select>
          </Field>
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
            <Field label="Số tiền giảm (VND)">
              <Input
                required
                inputMode="numeric"
                pattern="[1-9][0-9]{0,14}"
                value={discountAmount}
                onChange={(event) => setDiscountAmount(event.target.value)}
              />
            </Field>
          ) : (
            <div className="sm:col-span-2">
              <Field label="Mô tả phần quà">
                <Textarea
                  required
                  maxLength={1000}
                  value={rewardDescription}
                  onChange={(event) => setRewardDescription(event.target.value)}
                />
              </Field>
            </div>
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
          <div className="sm:col-span-2">
            <Button disabled={busy}>{busy ? <BusyLabel>Đang lưu</BusyLabel> : "Tạo voucher"}</Button>
          </div>
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
        <div className="grid gap-4 lg:grid-cols-2">
          {resource.data.map((definition) => (
            <Card key={definition.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs muted">{definition.type === "DISCOUNT" ? "Ưu đãi" : "Quà tặng"}</p>
                  <h2 className="mt-1 font-extrabold">{definition.title}</h2>
                </div>
                <StatusText tone={definition.isActive ? "green" : "neutral"}>
                  {definition.isActive ? "Đang hoạt động" : "Đã tắt"}
                </StatusText>
              </div>
              <p className="mt-3 text-sm muted">
                {definition.type === "DISCOUNT" && definition.discountAmount
                  ? `Giảm ${formatPrice(definition.discountAmount)}`
                  : definition.rewardDescription}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-bold">
                  {definition.pointsCost.toLocaleString("vi-VN")} điểm
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId !== null}
                  onClick={() => void toggle(definition)}
                >
                  {busyId === definition.id ? (
                    <BusyLabel>Đang lưu</BusyLabel>
                  ) : definition.isActive ? (
                    "Tắt voucher"
                  ) : (
                    "Bật voucher"
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
export function MerchantRewards() {
  return <MissingEndpoint title="Trao thưởng" />;
}

export function MerchantLoyalty() {
  const token = useToken();
  const resource = useResource(() => api.getLoyaltyConfig(token), [token]);
  const [draft, setDraft] = useState<LoyaltyConfigInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
      setDraft(null);
      setNotice("Đã lưu cấu hình.");
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Cấu hình Loyalty" />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !form ? (
        <EmptyState title="Chưa có cấu hình" description="Cấu hình chưa khả dụng." />
      ) : (
        <Card className="max-w-4xl p-6 sm:p-8">
          <form onSubmit={save} className="space-y-6">
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
                              i === index ? { ...item, minLifetimePoints: Number(event.target.value) } : item,
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
      )}
    </>
  );
}
