import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Dropdown, Flex, Typography, type TableColumnsType } from "antd";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient, translateApiError } from "../../api/commerce-http";
import type {
  ProductCategoryDto,
  ProductDto,
  ProductKind,
  ProductListQuery,
  ProductPatch,
  ProductSortOption,
  ProductStatus,
} from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { Button as UiButton, EmptyState, ErrorState, LoadingState } from "../../components/ui";
import { ConfirmActionDialog } from "../../components/ui/ConfirmActionDialog";
import { money } from "../../lib/utils";
import { CmsDataTable, CmsPageHeader, CmsStatusTag } from "./cms";
import { MerchantProductFiltersBar } from "./MerchantProductFiltersBar";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function buildProductQuery(filters: {
  q: string;
  categoryId: string;
  status: "" | ProductStatus;
  kind: "" | ProductKind;
  lowStock: boolean;
  sort: ProductSortOption;
  page: number;
}): ProductListQuery {
  const query: ProductListQuery = {};
  if (filters.q.trim()) query.q = filters.q.trim();
  if (filters.categoryId) query.categoryId = Number(filters.categoryId);
  if (filters.status) query.status = filters.status;
  if (filters.kind) query.kind = filters.kind;
  if (filters.lowStock) query.lowStock = true;
  if (filters.sort !== "newest") query.sort = filters.sort;
  if (filters.page > 1) query.page = filters.page;
  return query;
}

export function MerchantProducts() {
  const { accessToken } = useAuthSession();
  const navigate = useNavigate();
  if (!accessToken) throw new Error("Phiên đăng nhập đã hết hạn");
  const token = accessToken;
  const [qInput, setQInput] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ProductStatus>("");
  const [kindFilter, setKindFilter] = useState<"" | ProductKind>("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sort, setSort] = useState<ProductSortOption>("newest");
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<ProductCategoryDto[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [pendingStatusProduct, setPendingStatusProduct] = useState<ProductDto | null>(null);
  const [statusError, setStatusError] = useState("");

  const loadCategories = useCallback(async () => {
    setCategoriesError(null);
    try {
      setCategories((await api.listOwnCategories(token)).categories);
    } catch (reason) {
      const raw = reason instanceof Error ? reason.message : "";
      if (raw === "Not found" || raw.includes("404")) setCategories([]);
      else setCategoriesError(translateApiError(raw || "Không thể tải danh mục."));
    }
  }, [token]);
  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const query = buildProductQuery({
    q: appliedQ,
    categoryId: categoryFilter,
    status: statusFilter,
    kind: kindFilter,
    lowStock: lowStockOnly,
    sort,
    page,
  });
  const resource = useResource(() => api.listOwnProducts(token, query), [token, JSON.stringify(query)]);
  const hasActiveFilters = Boolean(
    appliedQ.trim() || categoryFilter || statusFilter || kindFilter || lowStockOnly || sort !== "newest",
  );

  function applySearch(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setAppliedQ(qInput);
  }

  function clearFilters() {
    setQInput("");
    setAppliedQ("");
    setCategoryFilter("");
    setStatusFilter("");
    setKindFilter("");
    setLowStockOnly(false);
    setSort("newest");
    setPage(1);
  }

  async function confirmStatusChange() {
    if (!pendingStatusProduct || busy) return;
    setBusy(true);
    setStatusError("");
    setNotice("");
    try {
      const product = pendingStatusProduct;
      const patch: ProductPatch = { status: product.status === "ACTIVE" ? "HIDDEN" : "ACTIVE" };
      const result = await api.updateProduct(product.id, patch, token);
      if (statusFilter) {
        resource.reload();
      } else {
        resource.setData((previous) =>
          previous
            ? {
                ...previous,
                items: previous.items.map((item) => (item.id === product.id ? result.product : item)),
              }
            : previous,
        );
      }
      setNotice("Đã cập nhật trạng thái sản phẩm.");
      setPendingStatusProduct(null);
    } catch (reason) {
      setStatusError(translateApiError(reason instanceof Error ? reason.message : "Yêu cầu thất bại"));
    } finally {
      setBusy(false);
    }
  }

  const items = resource.data?.items ?? [];
  const pagination = resource.data?.pagination ?? { page: 1, limit: 20, totalItems: 0, totalPages: 0 };
  const columns: TableColumnsType<ProductDto> = [
    {
      title: "Sản phẩm",
      dataIndex: "name",
      key: "name",
      width: 260,
      render: (_: string, product) => (
        <Flex align="center" gap={12} className="min-w-52">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt=""
              className="size-10 rounded-md border border-[#e3e9e2] object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <Typography.Text strong>{product.name}</Typography.Text>
            <Flex gap={6} wrap className="mt-1">
              <Typography.Text type="secondary">#{product.id}</Typography.Text>
              {product.sku ? <Typography.Text type="secondary">SKU: {product.sku}</Typography.Text> : null}
              {product.isLowStock ? (
                <CmsStatusTag label={`Sắp hết hàng (≤ ${product.lowStockThreshold ?? 5})`} tone="warning" />
              ) : null}
            </Flex>
          </div>
        </Flex>
      ),
    },
    { title: "Danh mục", key: "category", render: (_: unknown, product) => product.category?.name ?? "—" },
    {
      title: "Loại",
      dataIndex: "kind",
      key: "kind",
      render: (kind: ProductKind) => (kind === "REWARD" ? "Đổi thưởng" : "Bán"),
    },
    {
      title: "Giá",
      dataIndex: "price",
      key: "price",
      align: "right",
      render: (price: string, product) => (product.kind === "REWARD" ? "—" : money(Number(price))),
    },
    {
      title: "Tồn kho",
      key: "inventory",
      render: (_: unknown, product) => (
        <span>
          <strong>{product.inventory?.availableQuantity ?? "—"}</strong>{" "}
          <Typography.Text type="secondary">có thể bán</Typography.Text>
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status: ProductStatus, product) => (
        <Flex align="center" gap={8} wrap>
          <CmsStatusTag
            label={status === "ACTIVE" ? "Đang hoạt động" : "Đã ẩn"}
            tone={status === "ACTIVE" ? "success" : "neutral"}
          />
          <UiButton
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            aria-label={`${status === "ACTIVE" ? "Ẩn" : "Hiển thị"} sản phẩm ${product.name}`}
            onClick={() => {
              setStatusError("");
              setPendingStatusProduct(product);
            }}
          >
            {status === "ACTIVE" ? "Ẩn" : "Hiển thị"}
          </UiButton>
        </Flex>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      render: (_: unknown, product) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "edit", label: "Chỉnh sửa sản phẩm" },
              {
                key: "adjust",
                label: product.kind === "REWARD" ? "Điều chỉnh số lượng quà" : "Điều chỉnh tồn kho",
              },
              { key: "history", label: product.kind === "REWARD" ? "Lịch sử số lượng" : "Lịch sử tồn kho" },
            ],
            onClick: ({ key }) => {
              if (key === "edit") navigate(`/merchant/products/${product.id}/edit`);
              if (key === "adjust" || key === "history")
                navigate(
                  `/merchant/inventory/${product.kind === "REWARD" ? "reward" : "product"}/${product.id}${key === "history" ? "?tab=history" : ""}`,
                );
            },
          }}
        >
          <Button size="small" disabled={busy} aria-label={`Thao tác sản phẩm ${product.name}`}>
            Thao tác
          </Button>
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <CmsPageHeader
        title="Sản phẩm"
        action={
          <Flex gap={8} wrap>
            <Button onClick={() => navigate("/merchant/categories")}>Quản lý danh mục</Button>
            <Button type="primary" onClick={() => navigate("/merchant/products/new")}>
              Thêm sản phẩm
            </Button>
          </Flex>
        }
      />
      {notice ? <Alert type="success" showIcon title={notice} className="mb-4" /> : null}
      {categoriesError ? (
        <Alert
          type="error"
          showIcon
          title={categoriesError}
          action={
            <Button size="small" onClick={() => void loadCategories()}>
              Thử lại
            </Button>
          }
          className="mb-4"
        />
      ) : null}
      <MerchantProductFiltersBar
        qInput={qInput}
        onQInputChange={setQInput}
        onSearchSubmit={applySearch}
        categories={categories}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={(value) => {
          setPage(1);
          setCategoryFilter(value);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(value) => {
          setPage(1);
          setStatusFilter(value);
        }}
        kindFilter={kindFilter}
        onKindFilterChange={(value) => {
          setPage(1);
          setKindFilter(value);
        }}
        sort={sort}
        onSortChange={(value) => {
          setPage(1);
          setSort(value);
        }}
        lowStockOnly={lowStockOnly}
        onLowStockOnlyChange={(value) => {
          setPage(1);
          setLowStockOnly(value);
        }}
      />
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? "Không tìm thấy sản phẩm" : "Chưa có sản phẩm"}
          description={
            hasActiveFilters
              ? "Thử đổi từ khóa hoặc bộ lọc để xem thêm sản phẩm."
              : "Thêm sản phẩm để bán hoặc dùng làm quà đổi thưởng."
          }
          action={
            hasActiveFilters ? (
              <Button onClick={clearFilters}>Xóa bộ lọc</Button>
            ) : (
              <Button type="primary" onClick={() => navigate("/merchant/products/new")}>
                Thêm sản phẩm
              </Button>
            )
          }
        />
      ) : (
        <>
          <Typography.Text type="secondary" className="mb-2 block">
            Trang {pagination.page} / {Math.max(1, pagination.totalPages)} · {pagination.totalItems} sản phẩm
          </Typography.Text>
          <CmsDataTable
            label="Sản phẩm"
            rows={items}
            columns={columns}
            rowKey="id"
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: pagination.totalItems,
              showSizeChanger: false,
              onChange: (nextPage) => setPage(nextPage),
            }}
          />
        </>
      )}
      <ConfirmActionDialog
        open={pendingStatusProduct !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setPendingStatusProduct(null);
            setStatusError("");
          }
        }}
        title={pendingStatusProduct?.status === "ACTIVE" ? "Ẩn sản phẩm?" : "Hiển thị sản phẩm?"}
        description={
          pendingStatusProduct?.status === "ACTIVE"
            ? `“${pendingStatusProduct.name}” sẽ không còn xuất hiện trong gian hàng công khai. Tồn kho và lịch sử vẫn được giữ.`
            : `“${pendingStatusProduct?.name}” sẽ xuất hiện lại trong gian hàng công khai.`
        }
        confirmLabel={pendingStatusProduct?.status === "ACTIVE" ? "Xác nhận ẩn" : "Xác nhận hiển thị"}
        busy={busy}
        error={statusError}
        onConfirm={confirmStatusChange}
      />
    </>
  );
}
