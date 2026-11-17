import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { translateApiError } from "../../api/commerce-http";
import { useResource } from "../../api/useResource";
import { Button, BusyLabel, Card, EmptyState, Field, Input, PageHeader, Select } from "../../components/ui";
import { commerce, money, useMerchantContext } from "./member-context";

export function MemberCart() {
  const { basePath, cart } = useMerchantContext();
  const stockIssue = cart.lines.find(
    ({ product, quantity }) => quantity > (product.inventory?.availableQuantity ?? quantity),
  );
  return (
    <>
      <PageHeader title="Giỏ hàng" />
      {!cart.lines.length ? (
        <EmptyState
          title="Giỏ hàng trống"
          description="Chọn sản phẩm từ gian hàng để tạo đơn."
          action={
            <Button asChild>
              <Link to={basePath}>Xem sản phẩm</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            {cart.lines.map(({ product, quantity }) => (
              <Card key={product.id} className="p-4 sm:p-5">
                <h2 className="font-extrabold break-words">{product.name}</h2>
                <p className="mt-1 text-sm muted tabular-nums break-words">
                  {money(product.price)} mỗi sản phẩm
                </p>
                <div className="mt-3">
                  <Field label="Số lượng">
                    <Input
                      type="number"
                      min={1}
                      max={Math.min(99, product.inventory?.availableQuantity ?? 99)}
                      aria-label={`Số lượng ${product.name}`}
                      value={quantity}
                      onChange={(event) => {
                        const val = event.target.valueAsNumber;
                        if (!Number.isNaN(val)) cart.setQuantity(product.id, val);
                      }}
                    />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3 text-[#a4473a] hover:text-[#8d382d]"
                  aria-label={`Bỏ ${product.name} khỏi giỏ hàng`}
                  onClick={() => cart.removeProduct(product.id)}
                >
                  Bỏ sản phẩm
                </Button>
              </Card>
            ))}
          </div>
          <Card className="h-fit p-4 sm:p-5">
            <p className="text-xs muted">Tạm tính</p>
            <p className="mt-2 text-2xl font-extrabold tabular-nums break-words">{money(cart.subtotal)}</p>
            {stockIssue && (
              <p role="alert" className="mt-3 text-sm text-[#a4473a]">
                Số lượng {stockIssue.product.name} vượt tồn kho hiện tại.
              </p>
            )}
            <Button asChild className="mt-5 w-full" disabled={Boolean(stockIssue)}>
              <Link to={`${basePath}/checkout`} aria-disabled={Boolean(stockIssue)}>
                Tiếp tục <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}

export function MemberCheckout() {
  const { merchantId, basePath, cart } = useMerchantContext();
  const { accessToken } = useAuthSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [voucherId, setVoucherId] = useState("");
  const [earningEstimate, setEarningEstimate] = useState<string | null>(null);
  const vouchers = useResource(
    () => commerce.listMemberVouchers(merchantId, accessToken!).then((response) => response.vouchers),
    [merchantId, accessToken],
  );
  const availableDiscounts = useMemo(
    () =>
      (vouchers.data ?? []).filter(
        (voucher) => voucher.type === "DISCOUNT" && voucher.status === "AVAILABLE" && !voucher.reserved,
      ),
    [vouchers.data],
  );
  const reservedDiscounts = useMemo(
    () =>
      (vouchers.data ?? []).filter(
        (voucher) =>
          voucher.type === "DISCOUNT" &&
          (voucher.status === "RESERVED" || (voucher.status === "AVAILABLE" && voucher.reserved)),
      ),
    [vouchers.data],
  );

  const selectedDiscountAmount = useMemo(() => {
    if (!voucherId || !vouchers.data) return "0";
    const voucher = vouchers.data.find(
      (v) => String(v.id) === voucherId && v.type === "DISCOUNT" && v.status === "AVAILABLE" && !v.reserved,
    );
    return voucher?.discountAmount ?? "0";
  }, [voucherId, vouchers.data]);

  const netOrderAmountString = useMemo(() => {
    const discountVal = BigInt(selectedDiscountAmount);
    const netAmount = cart.subtotal > discountVal ? cart.subtotal - discountVal : 0n;
    return String(netAmount);
  }, [cart.subtotal, selectedDiscountAmount]);
  const stockIssue = cart.lines.find(
    ({ product, quantity }) => quantity > (product.inventory?.availableQuantity ?? quantity),
  );

  useEffect(() => {
    let active = true;
    if (!accessToken || !cart.lines.length) {
      setEarningEstimate(null);
      return;
    }
    commerce
      .previewMemberEarning(merchantId, netOrderAmountString, accessToken)
      .then((res) => {
        if (active) setEarningEstimate(res.estimatedPointsExact);
      })
      .catch(() => {
        if (active) setEarningEstimate(null);
      });
    return () => {
      active = false;
    };
  }, [accessToken, merchantId, netOrderAmountString, cart.lines.length]);

  async function submit() {
    if (!cart.lines.length || !accessToken || busy) return;
    if (stockIssue) {
      setError(`Số lượng ${stockIssue.product.name} vượt tồn kho hiện tại. Hãy điều chỉnh giỏ hàng.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const items = cart.lines.map(({ product, quantity }) => ({ productId: product.id, quantity }));
      const { order } = await commerce.createOrder(
        {
          ...(items.length === 1 ? items[0] : { items }),
          ...(voucherId ? { voucherId: Number(voucherId) } : {}),
        },
        accessToken,
      );
      cart.clear();
      navigate(`${basePath}/orders/${order.id}`, { state: { order } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo đơn");
      if (reason instanceof Error) {
        setError(translateApiError(reason.message));
        if (reason.message.includes("VOUCHER")) vouchers.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Xác nhận đơn hàng" />
      {!cart.lines.length ? (
        <EmptyState
          title="Chưa có sản phẩm"
          description="Vui lòng chọn sản phẩm trước khi tạo đơn."
          action={
            <Button asChild>
              <Link to={basePath}>Về gian hàng</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <Card className="p-4 sm:p-5">
            <ul className="divide-y divide-[#e5ece3]">
              {cart.lines.map(({ product, quantity }) => (
                <li key={product.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0 font-extrabold break-words">{product.name}</span>
                  <span className="shrink-0 text-sm muted tabular-nums">× {quantity}</span>
                </li>
              ))}
            </ul>
            {vouchers.loading ? (
              <div role="status" aria-live="polite" className="mt-4 flex items-center gap-2 text-sm muted">
                <BusyLabel>Đang tải voucher khả dụng…</BusyLabel>
              </div>
            ) : vouchers.error ? (
              <div role="alert" className="mt-4 rounded-xl bg-[#fff1d6] p-4 text-[#97682a]">
                <p className="text-sm font-semibold">Không tải được voucher</p>
                <p className="mt-1 text-xs break-words">{vouchers.error}</p>
                <Button
                  type="button"
                  className="mt-3 w-full sm:w-auto"
                  size="sm"
                  variant="outline"
                  onClick={vouchers.reload}
                >
                  Thử lại
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <Field label="Voucher giảm giá">
                  <Select
                    id="checkout-voucher-select"
                    aria-label="Voucher giảm giá"
                    value={voucherId}
                    onChange={(event) => setVoucherId(event.target.value)}
                  >
                    <option value="">Không sử dụng voucher</option>
                    {availableDiscounts.map((voucher) => (
                      <option key={voucher.id} value={voucher.id}>
                        {voucher.title} · giảm {voucher.discountAmount ? money(voucher.discountAmount) : "—"}
                      </option>
                    ))}
                  </Select>
                  {!availableDiscounts.length && (
                    <span className="mt-2 block text-xs muted">Bạn chưa có voucher giảm giá khả dụng.</span>
                  )}
                  {reservedDiscounts.length > 0 && (
                    <p className="mt-3 rounded-lg bg-[#fff1d6] p-3 text-xs leading-5 text-[#97682a] break-words">
                      {reservedDiscounts.map((voucher) => `“${voucher.title}”`).join(", ")} đang được giữ bởi
                      đơn chờ thanh toán nên không thể dùng cho đơn hàng này hoặc ở cửa hàng khác.
                    </p>
                  )}
                </Field>
              </div>
            )}
          </Card>
          <Card className="h-fit p-4 sm:p-5">
            <p className="font-extrabold text-[#20392a]">Đơn chờ thanh toán</p>
            <div className="mt-3 space-y-2 border-b border-[#e5ece3] pb-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="muted">Tạm tính</span>
                <span className="shrink-0 font-semibold tabular-nums break-words">
                  {money(cart.subtotal)}
                </span>
              </div>
              {selectedDiscountAmount !== "0" && (
                <div className="flex justify-between gap-2 text-[#357044]">
                  <span>Voucher giảm giá</span>
                  <span className="shrink-0 font-semibold tabular-nums break-words">
                    −{money(selectedDiscountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-2 pt-1 font-bold">
                <span>Tổng dự tính</span>
                <span className="shrink-0 text-base text-[#335e3d] tabular-nums break-words">
                  {money(netOrderAmountString)}
                </span>
              </div>
            </div>
            {earningEstimate != null && (
              <p className="mt-3 text-xs text-[#357044] break-words">
                Ước tính tích lũy: +{earningEstimate} điểm
              </p>
            )}
            {stockIssue && (
              <p role="alert" className="mt-3 text-sm text-[#a4473a]">
                Số lượng {stockIssue.product.name} vượt tồn kho hiện tại.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-4 text-sm text-red-700 break-words">
                {error}
              </p>
            )}
            <Button
              type="button"
              className="mt-5 w-full"
              disabled={busy || vouchers.loading || Boolean(stockIssue)}
              onClick={submit}
            >
              {busy ? (
                <BusyLabel>Đang tạo đơn</BusyLabel>
              ) : (
                <>
                  Tạo đơn <ArrowRight aria-hidden="true" size={16} />
                </>
              )}
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}
