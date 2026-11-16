import type {
  LowStockProductDto,
  NoSalesProductDto,
  SlowMovingProductDto,
  TopProductDto,
} from "../../api/analytics-types";
import { Card, EmptyState, StatusText } from "../../components/ui";
import { money } from "../../lib/utils";

export function AnalyticsProductTables({
  topProducts,
  slowMovingProducts,
  noSales90DaysProducts,
  lowStockProducts,
}: {
  topProducts: TopProductDto[];
  slowMovingProducts: SlowMovingProductDto[];
  noSales90DaysProducts: NoSalesProductDto[];
  lowStockProducts: LowStockProductDto[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-label="Sản phẩm bán chạy" className="space-y-3">
        <h2 className="text-lg font-extrabold text-[#20392a]">Top sản phẩm bán chạy</h2>
        {topProducts.length === 0 ? (
          <EmptyState
            title="Chưa có dữ liệu bán chạy"
            description="Chưa có sản phẩm nào được bán trong khoảng thời gian này."
          />
        ) : (
          <Card className="overflow-x-auto rounded-3xl">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#f7f9f5] text-xs font-bold uppercase tracking-wide text-[#65746a]">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Sản phẩm
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Đã bán
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Doanh thu
                  </th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((item) => (
                  <tr key={item.productId} className="border-t border-[#edf1ea]">
                    <th scope="row" className="px-5 py-3.5 font-bold">
                      {item.productName}
                      {item.sku && <span className="mt-0.5 block text-xs font-normal muted">SKU: {item.sku}</span>}
                    </th>
                    <td className="px-4 py-3.5 text-right tabular-nums">{item.unitsSold}</td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                      {money(Number(item.revenueVnd))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section aria-label="Sản phẩm bán chậm" className="space-y-3">
        <h2 className="text-lg font-extrabold text-[#20392a]">Sản phẩm bán chậm</h2>
        {slowMovingProducts.length === 0 ? (
          <EmptyState
            title="Chưa có sản phẩm đang bán"
            description="Thêm sản phẩm SALE đang hiển thị để theo dõi tốc độ bán."
          />
        ) : (
          <Card className="overflow-x-auto rounded-3xl">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#f7f9f5] text-xs font-bold uppercase tracking-wide text-[#65746a]">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Sản phẩm
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Đã bán
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Tồn khả dụng
                  </th>
                </tr>
              </thead>
              <tbody>
                {slowMovingProducts.map((item) => (
                  <tr key={item.productId} className="border-t border-[#edf1ea]">
                    <th scope="row" className="px-5 py-3.5 font-bold">
                      {item.productName}
                      {item.sku && <span className="mt-0.5 block text-xs font-normal muted">SKU: {item.sku}</span>}
                    </th>
                    <td className="px-4 py-3.5 text-right tabular-nums">{item.unitsSold}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{item.availableQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section aria-label="Không phát sinh đơn 90 ngày" className="space-y-3">
        <h2 className="text-lg font-extrabold text-[#20392a]">Không phát sinh đơn 90 ngày</h2>
        {noSales90DaysProducts.length === 0 ? (
          <EmptyState
            title="Không có sản phẩm tồn đọng"
            description="Mọi sản phẩm đang bán đều có giao dịch trong 90 ngày gần nhất."
          />
        ) : (
          <Card className="overflow-x-auto rounded-3xl">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#f7f9f5] text-xs font-bold uppercase tracking-wide text-[#65746a]">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Sản phẩm
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Tồn khả dụng
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Bán gần nhất
                  </th>
                </tr>
              </thead>
              <tbody>
                {noSales90DaysProducts.map((item) => (
                  <tr key={item.productId} className="border-t border-[#edf1ea]">
                    <th scope="row" className="px-5 py-3.5 font-bold">
                      {item.productName}
                      {item.sku && <span className="mt-0.5 block text-xs font-normal muted">SKU: {item.sku}</span>}
                    </th>
                    <td className="px-4 py-3.5 text-right tabular-nums">{item.availableQuantity}</td>
                    <td className="px-5 py-3.5 text-xs muted">
                      {item.lastSoldAt ? new Date(item.lastSoldAt).toLocaleDateString("vi-VN") : "Chưa từng bán"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section aria-label="Cảnh báo tồn kho thấp" className="space-y-3">
        <h2 className="text-lg font-extrabold text-[#20392a]">Cảnh báo tồn kho thấp</h2>
        {lowStockProducts.length === 0 ? (
          <EmptyState
            title="Tồn kho ổn định"
            description="Không có sản phẩm nào chạm ngưỡng cảnh báo tồn kho thấp."
          />
        ) : (
          <Card className="overflow-x-auto rounded-3xl">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#f7f9f5] text-xs font-bold uppercase tracking-wide text-[#65746a]">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Sản phẩm
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Tồn khả dụng
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Ngưỡng cảnh báo
                  </th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((item) => (
                  <tr key={item.productId} className="border-t border-[#edf1ea]">
                    <th scope="row" className="px-5 py-3.5 font-bold">
                      {item.productName}
                      {item.sku && <span className="mt-0.5 block text-xs font-normal muted">SKU: {item.sku}</span>}
                    </th>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      <StatusText tone={item.availableQuantity <= 0 ? "red" : "amber"}>
                        {item.availableQuantity}
                      </StatusText>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{item.lowStockThreshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
