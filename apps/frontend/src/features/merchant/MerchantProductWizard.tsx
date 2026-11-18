import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Descriptions, Flex, Form, Input, InputNumber, Select, Steps } from "antd";
import { createCommerceClient, translateApiError } from "../../api/commerce-http";
import type { ProductCategoryDto, ProductDto } from "../../api/commerce-types";
import { CmsPageHeader } from "./cms";
import { MerchantProductGalleryEditor, type GalleryDraft } from "./MerchantProductGalleryEditor";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

type ProductFormState = {
  kind: ProductDto["kind"];
  name: string;
  price: string;
  sku: string;
  categoryId: string;
  lowStockThreshold: string;
  description: string;
  richDescription: string;
  images: GalleryDraft[];
  status: ProductDto["status"];
  initialQuantity: string;
};

function initialState(product: ProductDto | null): ProductFormState {
  if (!product) {
    return {
      kind: "SALE", name: "", price: "", sku: "", categoryId: "", lowStockThreshold: "5",
      description: "", richDescription: "", images: [], status: "ACTIVE", initialQuantity: "0",
    };
  }
  const images = product.images?.length
    ? product.images.map(({ url, altText }) => ({ url, altText: altText ?? "" }))
    : product.imageUrl ? [{ url: product.imageUrl, altText: "" }] : [];
  return {
    kind: product.kind ?? "SALE", name: product.name, price: product.price, sku: product.sku ?? "",
    categoryId: product.categoryId ? String(product.categoryId) : "",
    lowStockThreshold: String(product.lowStockThreshold ?? 5), description: product.description ?? "",
    richDescription: product.richDescription ?? "", images, status: product.status, initialQuantity: "0",
  };
}

export function MerchantProductWizard({
  product,
  categories,
  token,
  onCancel,
  onSaved,
}: {
  product: ProductDto | null;
  categories: ProductCategoryDto[];
  token: string;
  onCancel(): void;
  onSaved(saved: ProductDto, isNew: boolean): void;
}) {
  const isNew = product === null;
  const [form, setForm] = useState(() => initialState(product));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (patch: Partial<ProductFormState>) => setForm((current) => ({ ...current, ...patch }));

  function validateBasics() {
    if (!form.name.trim()) return "Nhập tên sản phẩm để tiếp tục.";
    if (form.kind === "SALE" && !/^[1-9][0-9]{0,14}$/.test(form.price.trim())) {
      return "Giá phải là số nguyên dương, tối đa 15 chữ số.";
    }
    const threshold = Number(form.lowStockThreshold);
    if (!Number.isSafeInteger(threshold) || threshold < 0 || threshold > 100000) {
      return "Ngưỡng tồn kho phải là số nguyên từ 0 đến 100.000.";
    }
    if (isNew) {
      const initialQuantity = Number(form.initialQuantity);
      if (!Number.isSafeInteger(initialQuantity) || initialQuantity < 0 || initialQuantity > 2147483647) {
        return "Số lượng ban đầu phải là số nguyên không âm.";
      }
    }
    return "";
  }

  function changeStep(next: number) {
    if (busy) return;
    const problem = next > step ? validateBasics() : "";
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setStep(next);
  }

  const nextStep = () => changeStep(Math.min(2, step + 1));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (step < 2) {
      nextStep();
      return;
    }
    const problem = validateBasics();
    if (problem) {
      setStep(0);
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    const images = form.images
      .map((image, index) => ({ url: image.url.trim(), altText: image.altText.trim() || null, sortOrder: index }))
      .filter((image) => image.url.length > 0);
    const categoryId = form.categoryId ? Number(form.categoryId) : null;
    const sku = form.sku.trim() || null;
    const richDescription = form.richDescription.trim() ? form.richDescription : null;
    const threshold = Number(form.lowStockThreshold || "5");
    try {
      if (isNew) {
        const base = {
          name: form.name.trim(), description: form.description || null,
          imageUrl: images[0]?.url ?? null, ...(images.length ? { images } : {}),
          ...(richDescription !== null ? { richDescription } : {}), ...(sku ? { sku } : {}),
          ...(categoryId !== null ? { categoryId } : {}), ...(threshold !== 5 ? { lowStockThreshold: threshold } : {}),
          initialQuantity: Number(form.initialQuantity || "0"),
        };
        const result = await api.createProduct(
          form.kind === "REWARD" ? { ...base, kind: "REWARD" } : { ...base, price: form.price.trim() },
          token,
        );
        onSaved(result.product, true);
      } else if (product) {
        const result = await api.updateProduct(product.id, {
          name: form.name.trim(), description: form.description || null, richDescription, sku, categoryId,
          lowStockThreshold: threshold, images, ...(form.kind === "SALE" ? { price: form.price.trim() } : {}),
          status: form.status,
        }, token);
        onSaved(result.product, false);
      }
    } catch (reason) {
      setError(translateApiError(reason instanceof Error ? reason.message : "Không thể lưu sản phẩm."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto grid w-full min-w-0 max-w-6xl gap-6">
      <CmsPageHeader title={isNew ? "Thêm sản phẩm" : `Chỉnh sửa sản phẩm #${product.id}`} />
      <Card styles={{ body: { padding: "clamp(16px, 3vw, 32px)" } }}>
        <Steps current={step} onChange={changeStep} responsive items={[{ title: "Thông tin" }, { title: "Mô tả và ảnh" }, { title: "Kiểm tra" }]} />
        <Form layout="vertical" style={{ marginTop: 32 }} onSubmitCapture={(event) => void submit(event)}>
          <fieldset disabled={busy} className="min-w-0">
          {step === 0 ? (
            <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
              <Form.Item label="Loại sản phẩm" htmlFor="merchant-product-kind">
                <Select id="merchant-product-kind" disabled={!isNew || busy} value={form.kind} onChange={(kind: ProductDto["kind"]) => update({ kind })} options={[{ value: "SALE", label: "Sản phẩm bán" }, { value: "REWARD", label: "Chỉ đổi thưởng" }]} />
              </Form.Item>
              <Form.Item label="Tên sản phẩm" htmlFor="merchant-product-name" required>
                <Input id="merchant-product-name" maxLength={191} value={form.name} onChange={(event) => update({ name: event.target.value })} />
              </Form.Item>
              <Form.Item label="Mã SKU" htmlFor="merchant-product-sku">
                <Input id="merchant-product-sku" maxLength={64} placeholder="Ví dụ: CF-001" value={form.sku} onChange={(event) => update({ sku: event.target.value })} />
              </Form.Item>
              <Form.Item label="Danh mục" htmlFor="merchant-product-category">
                <Select id="merchant-product-category" allowClear value={form.categoryId || undefined} onChange={(categoryId) => update({ categoryId: categoryId ?? "" })} options={categories.map((category) => ({ value: String(category.id), label: category.name }))} placeholder="Không có danh mục" />
              </Form.Item>
              {form.kind === "SALE" ? <Form.Item label="Giá (VND)" htmlFor="merchant-product-price" required><Input id="merchant-product-price" inputMode="numeric" value={form.price} onChange={(event) => update({ price: event.target.value })} /></Form.Item> : null}
              {isNew ? <Form.Item label="Số lượng ban đầu" htmlFor="merchant-product-initial-quantity"><InputNumber id="merchant-product-initial-quantity" style={{ width: "100%" }} min={0} max={2147483647} precision={0} value={Number(form.initialQuantity)} onChange={(value) => update({ initialQuantity: String(value ?? "") })} /></Form.Item> : null}
              <Form.Item label="Ngưỡng cảnh báo tồn kho thấp" htmlFor="merchant-product-threshold"><InputNumber id="merchant-product-threshold" style={{ width: "100%" }} min={0} max={100000} precision={0} value={Number(form.lowStockThreshold)} onChange={(value) => update({ lowStockThreshold: String(value ?? "") })} /></Form.Item>
              {!isNew ? <Form.Item label="Trạng thái" htmlFor="merchant-product-status"><Select id="merchant-product-status" value={form.status} onChange={(status: ProductDto["status"]) => update({ status })} options={[{ value: "ACTIVE", label: "Đang hoạt động" }, { value: "HIDDEN", label: "Đã ẩn" }]} /></Form.Item> : null}
            </div>
          ) : null}
          {step === 1 ? (
            <div className="space-y-5">
              <Form.Item label="Mô tả ngắn" htmlFor="merchant-product-description"><Input.TextArea id="merchant-product-description" rows={3} maxLength={1000} value={form.description} onChange={(event) => update({ description: event.target.value })} /></Form.Item>
              <Form.Item label="Mô tả chi tiết" htmlFor="merchant-product-rich-description"><Input.TextArea id="merchant-product-rich-description" rows={5} maxLength={5000} placeholder="Thông tin nguồn gốc, hướng dẫn bảo quản…" value={form.richDescription} onChange={(event) => update({ richDescription: event.target.value })} /></Form.Item>
              <MerchantProductGalleryEditor images={form.images} onChange={(images) => update({ images })} />
            </div>
          ) : null}
          {step === 2 ? (
            <Card title="Kiểm tra thông tin" size="small">
              <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="Loại">{form.kind === "REWARD" ? "Chỉ đổi thưởng" : "Sản phẩm bán"}</Descriptions.Item>
                <Descriptions.Item label="Tên">{form.name.trim()}</Descriptions.Item>
                <Descriptions.Item label="SKU">{form.sku.trim() || "—"}</Descriptions.Item>
                <Descriptions.Item label="Danh mục">{categories.find((category) => String(category.id) === form.categoryId)?.name ?? "—"}</Descriptions.Item>
                <Descriptions.Item label="Giá">{form.kind === "REWARD" ? "—" : `${form.price} ₫`}</Descriptions.Item>
                <Descriptions.Item label="Tồn kho ban đầu">{isNew ? form.initialQuantity : "Không thay đổi"}</Descriptions.Item>
                <Descriptions.Item label="Ngưỡng tồn kho thấp">{form.lowStockThreshold}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái">{form.status === "ACTIVE" ? "Đang hoạt động" : "Đã ẩn"}</Descriptions.Item>
                <Descriptions.Item label="Ảnh" span="filled">{form.images.filter((image) => image.url.trim()).length}</Descriptions.Item>
                <Descriptions.Item label="Mô tả ngắn" span="filled"><div className="whitespace-pre-wrap break-words">{form.description || "—"}</div></Descriptions.Item>
                <Descriptions.Item label="Mô tả chi tiết" span="filled"><div className="whitespace-pre-wrap break-words">{form.richDescription || "—"}</div></Descriptions.Item>
              </Descriptions>
              <div className="flex flex-wrap gap-3">
                {form.images.filter((image) => image.url.trim()).map((image, index) => (
                  <img key={index} src={image.url.trim()} alt={image.altText || `Ảnh sản phẩm ${index + 1}`} className="size-24 rounded-lg border border-[#e3e9e2] object-cover" />
                ))}
              </div>
            </Card>
          ) : null}
          {error ? <Alert type="error" showIcon title={error} className="mt-4" /> : null}
          <Flex justify="space-between" gap={8} wrap style={{ marginTop: 24 }}>
            <Button onClick={onCancel} disabled={busy}>Hủy</Button>
            <Flex gap={8} wrap>
              {step > 0 ? <Button onClick={() => { setStep((current) => current - 1); setError(""); }} disabled={busy}>Quay lại</Button> : null}
              {step < 2 ? <Button key="next" type="primary" htmlType="button" onClick={(event) => { event.preventDefault(); nextStep(); }} disabled={busy}>Tiếp tục</Button> : <Button key="save" type="primary" htmlType="submit" loading={busy}>{isNew ? "Tạo sản phẩm" : "Lưu thay đổi"}</Button>}
            </Flex>
          </Flex>
          </fieldset>
        </Form>
      </Card>
    </section>
  );
}
