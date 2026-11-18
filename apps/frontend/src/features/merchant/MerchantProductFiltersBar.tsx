import type { FormEvent } from "react";
import { Button, Checkbox, Form, Input, Select } from "antd";
import type { ProductCategoryDto, ProductKind, ProductSortOption, ProductStatus } from "../../api/commerce-types";
import { CmsFilterBar } from "./cms";

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
    <CmsFilterBar label="Lọc sản phẩm">
      <Form onSubmitCapture={props.onSearchSubmit} className="flex min-w-[16rem] flex-1 items-end gap-2">
        <label className="min-w-0 flex-1 text-xs text-[#59685e]">
          <span className="mb-1 block">Tìm kiếm sản phẩm</span>
          <Input
            aria-label="Tìm kiếm sản phẩm"
            placeholder="Tên sản phẩm hoặc SKU"
            value={props.qInput}
            onChange={(event) => props.onQInputChange(event.target.value)}
          />
        </label>
        <Button htmlType="submit">Tìm</Button>
      </Form>
      <label className="min-w-40 text-xs text-[#59685e]">
        <span className="mb-1 block">Danh mục</span>
        <Select
          aria-label="Lọc theo danh mục"
          className="w-full"
          value={props.categoryFilter}
          onChange={props.onCategoryFilterChange}
          options={[{ value: "", label: "Tất cả danh mục" }, ...props.categories.map((category) => ({ value: String(category.id), label: category.name }))]}
        />
      </label>
      <label className="min-w-40 text-xs text-[#59685e]">
        <span className="mb-1 block">Trạng thái</span>
        <Select
          aria-label="Lọc theo trạng thái"
          className="w-full"
          value={props.statusFilter}
          onChange={props.onStatusFilterChange}
          options={[{ value: "", label: "Tất cả trạng thái" }, { value: "ACTIVE", label: "Đang hoạt động" }, { value: "HIDDEN", label: "Đã ẩn" }]}
        />
      </label>
      <label className="min-w-36 text-xs text-[#59685e]">
        <span className="mb-1 block">Loại</span>
        <Select
          aria-label="Lọc theo loại"
          className="w-full"
          value={props.kindFilter}
          onChange={props.onKindFilterChange}
          options={[{ value: "", label: "Tất cả loại" }, { value: "SALE", label: "Bán" }, { value: "REWARD", label: "Đổi thưởng" }]}
        />
      </label>
      <label className="min-w-36 text-xs text-[#59685e]">
        <span className="mb-1 block">Sắp xếp</span>
        <Select
          aria-label="Sắp xếp"
          className="w-full"
          value={props.sort}
          onChange={props.onSortChange}
          options={[{ value: "newest", label: "Mới nhất" }, { value: "price_asc", label: "Giá tăng dần" }, { value: "price_desc", label: "Giá giảm dần" }, { value: "name_asc", label: "Tên A–Z" }]}
        />
      </label>
      <Checkbox checked={props.lowStockOnly} onChange={(event) => props.onLowStockOnlyChange(event.target.checked)}>
        Sắp hết hàng
      </Checkbox>
    </CmsFilterBar>
  );
}
