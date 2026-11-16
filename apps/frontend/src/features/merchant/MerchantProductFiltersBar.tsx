import type { FormEvent } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type {
  ProductCategoryDto,
  ProductKind,
  ProductSortOption,
  ProductStatus,
} from "../../api/commerce-types";
import { Button, Input, Select } from "../../components/ui";

type Props = {
  qInput: string;
  onQInputChange(value: string): void;
  onSearchSubmit(event: FormEvent): void;
  categories: ProductCategoryDto[];
  categoryFilter: string;
  onCategoryFilterChange(value: string): void;
  statusFilter: "" | ProductStatus;
  onStatusFilterChange(value: "" | ProductStatus): void;
  kindFilter: "" | ProductKind;
  onKindFilterChange(value: "" | ProductKind): void;
  sort: ProductSortOption;
  onSortChange(value: ProductSortOption): void;
  lowStockOnly: boolean;
  onLowStockOnlyChange(value: boolean): void;
};

export function MerchantProductFiltersBar(props: Props) {
  return (
    <div className="surface mb-5 flex flex-wrap items-center gap-3 rounded-3xl p-4">
      <form onSubmit={props.onSearchSubmit} className="flex min-w-[14rem] flex-1 items-center gap-2">
        <Input
          aria-label="Tìm kiếm sản phẩm"
          placeholder="Tìm theo tên hoặc SKU..."
          value={props.qInput}
          onChange={(event) => props.onQInputChange(event.target.value)}
        />
        <Button type="submit" size="sm" variant="outline">
          <MagnifyingGlass size={15} /> Tìm
        </Button>
      </form>

      <Select
        aria-label="Lọc theo danh mục"
        className="w-auto min-w-[10rem]"
        value={props.categoryFilter}
        onChange={(event) => props.onCategoryFilterChange(event.target.value)}
      >
        <option value="">Tất cả danh mục</option>
        {props.categories.map((cat) => (
          <option key={cat.id} value={String(cat.id)}>
            {cat.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Lọc theo trạng thái"
        className="w-auto min-w-[9rem]"
        value={props.statusFilter}
        onChange={(event) => props.onStatusFilterChange(event.target.value as "" | ProductStatus)}
      >
        <option value="">Tất cả trạng thái</option>
        <option value="ACTIVE">Đang hoạt động</option>
        <option value="HIDDEN">Đã ẩn</option>
      </Select>

      <Select
        aria-label="Lọc theo loại"
        className="w-auto min-w-[8rem]"
        value={props.kindFilter}
        onChange={(event) => props.onKindFilterChange(event.target.value as "" | ProductKind)}
      >
        <option value="">Tất cả loại</option>
        <option value="SALE">Bán</option>
        <option value="REWARD">Đổi thưởng</option>
      </Select>

      <Select
        aria-label="Sắp xếp"
        className="w-auto min-w-[9rem]"
        value={props.sort}
        onChange={(event) => props.onSortChange(event.target.value as ProductSortOption)}
      >
        <option value="newest">Mới nhất</option>
        <option value="price_asc">Giá tăng dần</option>
        <option value="price_desc">Giá giảm dần</option>
        <option value="name_asc">Tên A–Z</option>
      </Select>

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#f7f9f5] px-3 py-2 text-xs font-semibold text-[#294432]">
        <input
          type="checkbox"
          checked={props.lowStockOnly}
          onChange={(event) => props.onLowStockOnlyChange(event.target.checked)}
        />
        Sắp hết hàng
      </label>
    </div>
  );
}
