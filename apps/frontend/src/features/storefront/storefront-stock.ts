export function productStockDisplay(availableQuantity: number): {
  label: string;
  badgeClass: string;
  textClass: string;
} {
  if (availableQuantity <= 0) {
    return {
      label: "Hết hàng",
      badgeClass: "bg-[#fae7e3] text-[#ad3e32]",
      textClass: "text-[#ad3e32]",
    };
  }
  if (availableQuantity <= 10) {
    return {
      label: `Chỉ còn ${availableQuantity} sản phẩm`,
      badgeClass: "bg-[#fff2dc] text-[#a96512]",
      textClass: "text-[#a96512]",
    };
  }
  return {
    label: "Còn hàng",
    badgeClass: "bg-[#edf4e9] text-[#357044]",
    textClass: "text-[#357044]",
  };
}
