import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  Gift,
  Medal,
  Package,
  Plus,
  Receipt,
  Ticket,
  TrendUp,
} from "@phosphor-icons/react";
import { useApi } from "../../api/client";
import { useResource } from "../../api/useResource";
import type { LoyaltyConfig, Product, VoucherDefinition } from "../../api/types";
import {
  Badge,
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
import { money, number, shortDate } from "../../lib/utils";

const useMerchantId = () => useParams().merchantId ?? "moc";

export function MerchantOverview() {
  const id = useMerchantId();
  const api = useApi();
  const merchant = useResource(() => api.getMerchant(id), [id]);
  const products = useResource(() => api.listProducts(id), [id]);
  const orders = useResource(() => api.listOrders(id), [id]);
  const rewards = useResource(() => api.listRewardFulfillments(id), [id]);
  if (merchant.loading || products.loading || orders.loading || rewards.loading)
    return <LoadingState cards={4} />;
  if (merchant.error || products.error || orders.error || rewards.error)
    return (
      <ErrorState
        message={merchant.error ?? products.error ?? orders.error ?? rewards.error ?? "Lỗi tải dữ liệu"}
        retry={() => {
          merchant.reload();
          products.reload();
          orders.reload();
          rewards.reload();
        }}
      />
    );
  const paid = orders.data?.filter((o) => o.status === "PAID") ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Merchant workspace"
        title={`Chào mừng đến ${merchant.data?.name}`}
        description="Quản lý cửa hàng và theo dõi chương trình khách hàng thân thiết ở một nơi."
        action={
          <Button asChild>
            <Link to={`/member/${id}`}>
              Xem gian hàng <ArrowRight size={17} />
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Doanh số đã thanh toán"
          value={money(paid.reduce((n, o) => n + o.total, 0))}
          icon={<TrendUp size={20} />}
          note="Chỉ từ đơn PAID"
        />
        <StatCard
          label="Đơn hàng"
          value={orders.data?.length ?? 0}
          icon={<Receipt size={20} />}
          note={`${orders.data?.filter((o) => o.status === "PENDING").length ?? 0} đang chờ`}
        />
        <StatCard
          label="Sản phẩm"
          value={products.data?.filter((p) => p.active).length ?? 0}
          icon={<Package size={20} />}
          note="Đang hiển thị"
        />
        <StatCard
          label="Quà chờ trao"
          value={rewards.data?.filter((r) => r.status === "PENDING_FULFILLMENT").length ?? 0}
          icon={<Gift size={20} />}
          note="Cần Merchant xác nhận"
        />
      </div>
      <div className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold">Đơn gần đây</h2>
              <p className="mt-1 text-xs muted">Tình trạng đơn tại cửa hàng</p>
            </div>
            <Link className="text-xs font-bold accent" to={`/merchant/${id}/orders`}>
              Xem tất cả →
            </Link>
          </div>
          {orders.data?.length ? (
            <div className="divide-y divide-[#edf1ea]">
              {orders.data.slice(0, 4).map((o) => (
                <div key={o.id} className="flex items-center gap-3 py-4">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf4e9] accent">
                    <Receipt size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{o.id}</p>
                    <p className="mt-1 text-xs muted">
                      {o.memberName} · {shortDate(o.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm font-extrabold">{money(o.total)}</p>
                  <Badge tone={o.status === "PAID" ? "green" : "amber"}>
                    {o.status === "PAID" ? "PAID" : "PENDING"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có đơn hàng" description="Đơn mới sẽ xuất hiện tại đây." />
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="member-gradient p-7">
            <span className="inline-flex rounded-full bg-white/65 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#5b8657]">
              Loyalty program
            </span>
            <h2 className="serif mt-5 text-[2rem] leading-tight text-[#2f5138]">
              Khách quay lại, niềm vui ở lại.
            </h2>
            <p className="mt-3 text-xs leading-6 text-[#627665]">
              Thiết lập tier, điểm thưởng và voucher để mỗi lần mua sắm đều đáng nhớ.
            </p>
            <Button asChild className="mt-6">
              <Link to={`/merchant/${id}/loyalty`}>
                Cấu hình loyalty <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}

export function MerchantStore() {
  const id = useMerchantId();
  const api = useApi();
  const resource = useResource(() => api.getMerchant(id), [id]);
  const [form, setForm] = useState({ name: "", tagline: "", description: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (resource.data)
      setForm({
        name: resource.data.name,
        tagline: resource.data.tagline,
        description: resource.data.description,
        location: resource.data.location,
      });
  }, [resource.data]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const updated = await api.updateMerchant(id, form);
      resource.setData(updated);
      setMessage("Thông tin cửa hàng đã được lưu.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Cửa hàng / Hồ sơ"
        title="Thông tin cửa hàng"
        description="Giới thiệu cửa hàng của bạn với Member."
      />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <Card className="p-6 sm:p-8">
            <form onSubmit={save} className="space-y-5">
              <Field label="Tên cửa hàng">
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Thông điệp ngắn">
                <Input
                  required
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                />
              </Field>
              <Field label="Giới thiệu">
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <Field label="Địa điểm">
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </Field>
              {message && (
                <p role="status" className="rounded-xl bg-[#edf4e9] p-3 text-xs accent">
                  {message}
                </p>
              )}
              <Button disabled={busy}>{busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu thay đổi"}</Button>
            </form>
          </Card>
          <Card className="h-fit overflow-hidden">
            <div className="h-32" style={{ background: resource.data?.color }} />
            <div className="p-6">
              <span className="-mt-12 grid h-14 w-14 place-items-center rounded-2xl border-4 border-white bg-[#335e3d] text-xl font-extrabold text-white">
                {resource.data?.initials}
              </span>
              <h2 className="mt-4 text-xl font-extrabold">{form.name}</h2>
              <p className="mt-1 text-sm muted">{form.tagline}</p>
              <p className="mt-5 text-xs leading-6 muted">{form.description}</p>
              <Badge tone="green" className="mt-5">
                Cửa hàng đang hoạt động
              </Badge>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export function MerchantProducts() {
  const id = useMerchantId();
  const api = useApi();
  const resource = useResource(() => api.listProducts(id), [id]);
  const blank = { name: "", category: "", description: "", price: "", stock: "", image: "" };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function edit(p: Product) {
    setForm({
      name: p.name,
      category: p.category,
      description: p.description,
      price: String(p.price),
      stock: String(p.stock),
      image: p.image,
    });
    setEditing(p.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.saveProduct({
        id: editing ?? undefined,
        merchantId: id,
        name: form.name,
        category: form.category,
        description: form.description,
        price: Number(form.price),
        stock: Number(form.stock),
        image: form.image,
      });
      setShowForm(false);
      setEditing(null);
      setForm(blank);
      resource.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được sản phẩm");
    } finally {
      setBusy(false);
    }
  }
  async function toggle(p: Product) {
    setBusy(true);
    setError("");
    try {
      await api.toggleProduct(p.id, id);
      resource.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không cập nhật được");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Cửa hàng / Danh mục"
        title="Sản phẩm"
        description="Tạo, chỉnh sửa và ẩn sản phẩm trong gian hàng của bạn."
        action={
          <Button
            onClick={() => {
              setForm(blank);
              setEditing(null);
              setShowForm(!showForm);
            }}
          >
            <Plus size={17} />
            {showForm ? "Đóng form" : "Thêm sản phẩm"}
          </Button>
        }
      />
      {showForm && (
        <Card className="mb-6 p-6 sm:p-8">
          <h2 className="mb-5 text-lg font-extrabold">{editing ? "Chỉnh sửa sản phẩm" : "Sản phẩm mới"}</h2>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên sản phẩm">
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Danh mục">
              <Input
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </Field>
            <Field label="Giá (đ)">
              <Input
                required
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
            <Field label="Tồn kho">
              <Input
                required
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </Field>
            <Field label="URL ảnh">
              <Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
            </Field>
            <Field label="Mô tả">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            {error && (
              <p role="alert" className="text-xs text-[#a4473a] sm:col-span-2">
                {error}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button disabled={busy}>{busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu sản phẩm"}</Button>
            </div>
          </form>
        </Card>
      )}
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState
          title="Chưa có sản phẩm"
          description="Tạo sản phẩm đầu tiên để bắt đầu bán hàng."
          action={<Button onClick={() => setShowForm(true)}>Thêm sản phẩm</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-[#f8faf6] text-[10px] font-extrabold uppercase tracking-[.16em] text-[#8a9a8d]">
                <tr>
                  <th className="p-5">Sản phẩm</th>
                  <th className="p-5">Danh mục</th>
                  <th className="p-5">Giá</th>
                  <th className="p-5">Tồn kho</th>
                  <th className="p-5">Trạng thái</th>
                  <th className="p-5">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1ea]">
                {resource.data.map((p) => (
                  <tr key={p.id} className="text-sm">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-xl bg-[#eef2e9]">
                          {p.image ? (
                            <img src={p.image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Package size={20} className="m-3 accent" />
                          )}
                        </div>
                        <span className="font-bold">{p.name}</span>
                      </div>
                    </td>
                    <td className="p-5 muted">{p.category}</td>
                    <td className="p-5 font-bold">{money(p.price)}</td>
                    <td className="p-5">{p.stock}</td>
                    <td className="p-5">
                      <Badge tone={p.active ? "green" : "neutral"}>{p.active ? "Hiển thị" : "Đã ẩn"}</Badge>
                    </td>
                    <td className="p-5">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => edit(p)}>
                          Sửa
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => toggle(p)}>
                          {p.active ? "Ẩn" : "Hiện"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

export function MerchantOrders() {
  const id = useMerchantId();
  const api = useApi();
  const resource = useResource(() => api.listOrders(id), [id]);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "PAID">("ALL");
  const orders = resource.data?.filter((o) => filter === "ALL" || o.status === filter) ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Cửa hàng / Giao dịch"
        title="Đơn hàng"
        description="Theo dõi đơn. Trạng thái thanh toán và điểm thưởng chỉ đến từ API."
        action={
          <Select
            className="w-44"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ thanh toán</option>
            <option value="PAID">Đã thanh toán</option>
          </Select>
        }
      />
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !orders.length ? (
        <EmptyState title="Không có đơn hàng" description="Thử chọn trạng thái khác hoặc quay lại sau." />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <Card key={o.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs muted">
                    {shortDate(o.createdAt)} · {o.memberName}
                  </p>
                  <h2 className="mt-1 text-lg font-extrabold">Đơn {o.id}</h2>
                </div>
                <Badge tone={o.status === "PAID" ? "green" : "amber"}>
                  {o.status === "PAID" ? "Đã thanh toán" : "Chờ thanh toán"}
                </Badge>
              </div>
              <div className="mt-5 border-y border-[#edf1ea] py-3">
                {o.items.map((i) => (
                  <div key={i.productId} className="flex justify-between gap-4 py-2 text-sm">
                    <span className="muted">
                      {i.name} × {i.quantity}
                    </span>
                    <span className="font-semibold">{money(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs muted">
                  {o.status === "PAID"
                    ? `+${o.earnedPoints} điểm đã xác nhận`
                    : "Chưa phát điểm khi đơn PENDING"}
                </p>
                <p className="text-lg font-extrabold">{money(o.total)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function MerchantLoyalty() {
  const id = useMerchantId();
  const api = useApi();
  const resource = useResource(() => api.getLoyaltyConfig(id), [id]);
  const [form, setForm] = useState<LoyaltyConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (resource.data) setForm(resource.data);
  }, [resource.data]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setMessage("");
    try {
      if (form.baseAmount <= 0 || form.tiers.some((t) => t.threshold < 0 || t.multiplier <= 0))
        throw new Error("Ngưỡng và hệ số phải hợp lệ");
      const updated = await api.saveLoyaltyConfig(form);
      resource.setData(updated);
      setMessage("Cấu hình đã lưu. Chỉ áp dụng cho giao dịch tương lai.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }
  if (resource.loading)
    return (
      <>
        <PageHeader
          eyebrow="Loyalty / Cấu hình"
          title="Chương trình tích điểm"
          description="Tier dựa trên tổng điểm từng kiếm được. Tiêu điểm không làm giảm tier."
        />
        <LoadingState cards={2} />
      </>
    );
  if (resource.error)
    return (
      <>
        <PageHeader
          eyebrow="Loyalty / Cấu hình"
          title="Chương trình tích điểm"
          description="Tier dựa trên tổng điểm từng kiếm được. Tiêu điểm không làm giảm tier."
        />
        <ErrorState message={resource.error} retry={resource.reload} />
      </>
    );
  if (!form) return <LoadingState cards={2} />;
  return (
    <>
      <PageHeader
        eyebrow="Loyalty / Cấu hình"
        title="Chương trình tích điểm"
        description="Tier dựa trên tổng điểm từng kiếm được. Tiêu điểm không làm giảm tier."
      />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="p-6 sm:p-8">
          <form onSubmit={save}>
            <Field label="Mỗi bao nhiêu đồng thực trả nhận 1 điểm cơ bản?">
              <Input
                type="number"
                min="1"
                value={form.baseAmount}
                onChange={(e) => setForm({ ...form, baseAmount: Number(e.target.value) })}
              />
            </Field>
            <div className="mt-7">
              <div className="mb-3 grid grid-cols-[1fr_1fr_1fr] gap-3 text-[10px] font-extrabold uppercase tracking-widest muted">
                <span>Tier</span>
                <span>Điểm tích lũy</span>
                <span>Hệ số</span>
              </div>
              {form.tiers.map((t, index) => (
                <div
                  key={t.tier}
                  className="grid grid-cols-[1fr_1fr_1fr] items-center gap-3 border-t border-[#edf1ea] py-3"
                >
                  <Badge
                    tone={index === 0 ? "neutral" : index === 1 ? "green" : index === 2 ? "amber" : "purple"}
                  >
                    {t.tier}
                  </Badge>
                  <Input
                    aria-label={`Ngưỡng ${t.tier}`}
                    type="number"
                    min="0"
                    value={t.threshold}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tiers: form.tiers.map((x, i) =>
                          i === index ? { ...x, threshold: Number(e.target.value) } : x,
                        ),
                      })
                    }
                  />
                  <Input
                    aria-label={`Hệ số ${t.tier}`}
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={t.multiplier}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tiers: form.tiers.map((x, i) =>
                          i === index ? { ...x, multiplier: Number(e.target.value) } : x,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </div>
            {message && (
              <p role="status" className="mt-4 rounded-xl bg-[#edf4e9] p-3 text-xs accent">
                {message}
              </p>
            )}
            <Button className="mt-6" disabled={busy}>
              {busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu cấu hình"}
            </Button>
          </form>
        </Card>
        <Card className="h-fit bg-[#2e5539] p-7 text-white">
          <Medal size={31} weight="light" className="text-[#c8ea9f]" />
          <h2 className="serif mt-5 text-3xl">Mỗi điểm đều có ý nghĩa.</h2>
          <p className="mt-4 text-xs leading-6 text-white/70">
            Member mới là Unranked. Lần mua PAID đầu tiên tính theo hệ số Bronze; tier sau đó được xác định
            bằng lifetime earned points.
          </p>
          <div className="mt-6 rounded-2xl bg-white/10 p-4 text-xs leading-6 text-white/75">
            Sử dụng điểm để đổi voucher hoặc quà không làm giảm tier. Giao dịch đã hoàn tất không bị tính lại
            khi đổi cấu hình.
          </div>
        </Card>
      </div>
    </>
  );
}

export function MerchantVouchers() {
  const id = useMerchantId();
  const api = useApi();
  const resource = useResource(() => api.listVoucherDefinitions(id), [id]);
  const blank = {
    title: "",
    description: "",
    kind: "DISCOUNT" as VoucherDefinition["kind"],
    pointsCost: "",
    discountAmount: "",
  };
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function edit(v: VoucherDefinition) {
    setForm({
      title: v.title,
      description: v.description,
      kind: v.kind,
      pointsCost: String(v.pointsCost),
      discountAmount: String(v.discountAmount ?? ""),
    });
    setEditing(v.id);
    setShowForm(true);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.saveVoucherDefinition({
        id: editing ?? undefined,
        merchantId: id,
        title: form.title,
        description: form.description,
        kind: form.kind,
        pointsCost: Number(form.pointsCost),
        discountAmount: form.kind === "DISCOUNT" ? Number(form.discountAmount) : undefined,
      });
      resource.reload();
      setShowForm(false);
      setEditing(null);
      setForm(blank);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được voucher");
    } finally {
      setBusy(false);
    }
  }
  async function toggle(v: VoucherDefinition) {
    setBusy(true);
    try {
      await api.toggleVoucherDefinition(v.id, id);
      resource.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không cập nhật được");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Loyalty / Ưu đãi"
        title="Voucher & quà tặng"
        description="Thiết kế quyền lợi để Member đổi bằng điểm trong cửa hàng của bạn."
        action={
          <Button
            onClick={() => {
              setShowForm(!showForm);
              setEditing(null);
              setForm(blank);
            }}
          >
            <Plus size={17} />
            {showForm ? "Đóng form" : "Tạo mới"}
          </Button>
        }
      />
      {showForm && (
        <Card className="mb-6 p-6">
          <h2 className="mb-5 text-lg font-extrabold">{editing ? "Chỉnh sửa ưu đãi" : "Ưu đãi mới"}</h2>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên ưu đãi">
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Loại">
              <Select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as VoucherDefinition["kind"] })}
              >
                <option value="DISCOUNT">Voucher giảm giá</option>
                <option value="REWARD">Voucher nhận quà</option>
              </Select>
            </Field>
            <Field label="Điểm cần đổi">
              <Input
                required
                type="number"
                min="1"
                value={form.pointsCost}
                onChange={(e) => setForm({ ...form, pointsCost: e.target.value })}
              />
            </Field>
            {form.kind === "DISCOUNT" && (
              <Field label="Giá trị giảm (đ)">
                <Input
                  required
                  type="number"
                  min="1"
                  value={form.discountAmount}
                  onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
                />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field label="Mô tả">
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
            </div>
            {error && (
              <p role="alert" className="text-xs text-[#a4473a] sm:col-span-2">
                {error}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button disabled={busy}>{busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu ưu đãi"}</Button>
            </div>
          </form>
        </Card>
      )}
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState title="Chưa có ưu đãi" description="Tạo voucher hoặc reward đầu tiên." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resource.data.map((v) => (
            <Card key={v.id} className="p-6">
              <div className="flex items-start justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf4e9] accent">
                  {v.kind === "DISCOUNT" ? (
                    <Ticket size={23} weight="light" />
                  ) : (
                    <Gift size={23} weight="light" />
                  )}
                </span>
                <Badge tone={v.active ? "green" : "neutral"}>{v.active ? "Đang bật" : "Đã tắt"}</Badge>
              </div>
              <h2 className="mt-5 text-lg font-extrabold">{v.title}</h2>
              <p className="mt-2 min-h-10 text-xs leading-5 muted">{v.description}</p>
              <div className="mt-5 flex items-end justify-between border-t border-[#edf1ea] pt-4">
                <div>
                  <p className="text-xs muted">Giá đổi</p>
                  <p className="mt-1 text-xl font-extrabold accent">{number(v.pointsCost)} điểm</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => edit(v)}>
                    Sửa
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => toggle(v)}>
                    {v.active ? "Tắt" : "Bật"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function MerchantRewards() {
  const id = useMerchantId();
  const api = useApi();
  const resource = useResource(() => api.listRewardFulfillments(id), [id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function fulfill(voucherId: string) {
    if (busy) return;
    setBusy(voucherId);
    setError("");
    try {
      const updated = await api.fulfillReward(voucherId, id);
      resource.setData((prev) => prev?.map((v) => (v.id === voucherId ? updated : v)) ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xác nhận trao quà");
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Loyalty / Fulfillment"
        title="Trao thưởng"
        description="Chỉ xác nhận sau khi Merchant đã trao quà thực tế cho Member."
      />
      {error && (
        <p role="alert" className="mb-5 rounded-xl bg-[#fae7e3] p-4 text-sm text-[#a4473a]">
          {error}
        </p>
      )}
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState
          title="Chưa có yêu cầu nhận quà"
          description="Reward Voucher đã đổi sẽ xuất hiện ở đây."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {resource.data.map((v) => (
            <Card key={v.id} className="p-6">
              <div className="flex items-start justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f3ebdf] text-[#a27646]">
                  <Gift size={23} />
                </span>
                <Badge tone={v.status === "FULFILLED" ? "green" : "amber"}>
                  {v.status === "FULFILLED" ? "Đã trao quà" : "Chờ trao quà"}
                </Badge>
              </div>
              <h2 className="mt-5 text-lg font-extrabold">{v.title}</h2>
              <p className="mt-1 text-xs muted">
                Mã {v.id} · Đổi ngày {shortDate(v.issuedAt)}
              </p>
              <p className="mt-4 text-xs leading-6 muted">
                Member đã đổi điểm lấy quyền nhận quà. Việc xác nhận trao quà phải dựa vào kết quả API.
              </p>
              {v.status === "PENDING_FULFILLMENT" && (
                <Button className="mt-5" disabled={!!busy} onClick={() => fulfill(v.id)}>
                  {busy === v.id ? (
                    <BusyLabel>Đang xác nhận</BusyLabel>
                  ) : (
                    <>
                      <CheckCircle size={17} /> Xác nhận đã trao
                    </>
                  )}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
