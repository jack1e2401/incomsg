import { useCallback, useEffect, useState } from "react";
import { useAuthSession } from "../../api/auth-session";
import { Link } from "react-router-dom";
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
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../components/ui";
import { MerchantProductFiltersBar } from "./MerchantProductFiltersBar";
import { MerchantProductFormDialog } from "./MerchantProductFormDialog";
import { MerchantProductTableRow } from "./MerchantProductTableRow";

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

  const [editing, setEditing] = useState<ProductDto | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadCategories = useCallback(async () => {
    setCategoriesError(null);
    try {
      const response = await api.listOwnCategories(token);
      setCategories(response.categories);
    } catch (reason) {
      const raw = reason instanceof Error ? reason.message : "";
      if (raw === "Not found" || raw.includes("404")) {
        setCategories([]);
      } else {
        setCategoriesError(translateApiError(raw || "Không thể tải danh mục."));
      }
    }
  }, [token]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const queryObj = buildProductQuery({
    q: appliedQ,
    categoryId: categoryFilter,
    status: statusFilter,
    kind: kindFilter,
    lowStock: lowStockOnly,
    sort,
    page,
  });
  const queryKey = JSON.stringify(queryObj);

  const resource = useResource(
    () => api.listOwnProducts(token, queryObj),
    [token, queryKey],
  );

  function applySearch(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setAppliedQ(qInput);
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
          ? {
              ...previous,
              items: previous.items.map((item) => (item.id === product.id ? result.product : item)),
            }
          : previous,
      );
      setNotice("Đã cập nhật trạng thái sản phẩm.");
    } catch (reason) {
      const raw = reason instanceof Error ? reason.message : "Yêu cầu thất bại";
      setError(translateApiError(raw));
    } finally {
      setBusy(false);
    }
  }

  function handleProductSaved(saved: ProductDto, isNew: boolean) {
    resource.setData((previous) => {
      if (!previous) {
        return {
          items: [saved],
          pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
        };
      }
      return {
        ...previous,
        items: isNew
          ? [saved, ...previous.items]
          : previous.items.map((item) => (item.id === saved.id ? saved : item)),
        pagination: isNew
          ? {
              ...previous.pagination,
              totalItems: previous.pagination.totalItems + 1,
              totalPages: Math.max(1, Math.ceil((previous.pagination.totalItems + 1) / previous.pagination.limit)),
            }
          : previous.pagination,
      };
    });
    setNotice("Đã lưu sản phẩm.");
    setEditing(null);
  }

  const items = resource.data?.items ?? [];
  const pagination = resource.data?.pagination ?? { page: 1, limit: 20, totalItems: 0, totalPages: 0 };
  const totalPagesDisplay = Math.max(1, pagination.totalPages);

  return (
    <>
      <PageHeader
        title="Sản phẩm"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              variant="outline"
            >
              <Link to="/merchant/categories">Quản lý danh mục</Link>
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditing("new");
                setError("");
                setNotice("");
              }}
            >
              Thêm sản phẩm
            </Button>
          </div>
        }
      />

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
      {categoriesError && (
        <p role="alert" className="mb-4 rounded-xl bg-[#fae7e3] p-4 text-sm text-[#a4473a]">
          {categoriesError} <button type="button" className="font-bold underline" onClick={() => void loadCategories()}>Thử lại</button>
        </p>
      )}

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

      <MerchantProductFormDialog
        editing={editing}
        categories={categories}
        token={token}
        onClose={() => setEditing(null)}
        onSaved={handleProductSaved}
      />

      {resource.loading ? (
        <LoadingState cards={3} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Chưa có sản phẩm"
          description="Thêm sản phẩm để bán hoặc dùng làm quà đổi thưởng."
        />
      ) : (
        <>
          <div className="surface overflow-x-auto rounded-3xl">
            <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[9%]" />
                <col className="w-[12%]" />
                <col className="w-[30%]" />
                <col className="w-[13%]" />
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
                {items.map((product) => (
                  <MerchantProductTableRow
                    key={product.id}
                    product={product}
                    token={token}
                    onEdit={() => {
                      setEditing(product);
                      setError("");
                      setNotice("");
                    }}
                    onStatusChange={() => void changeStatus(product)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm muted">
            <span>
              Trang {pagination.page} / {totalPagesDisplay} · {pagination.totalItems} sản phẩm
            </span>
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
                disabled={pagination.page >= totalPagesDisplay}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
