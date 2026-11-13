import { useState } from "react";
import { CheckCircle, ShieldWarning } from "@phosphor-icons/react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import { useResource } from "../../api/useResource";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusText,
} from "../../components/ui";
import { AdminReasonDialog } from "./AdminReasonDialog";
import { PlatformFeeLedger } from "../finance/PlatformFeeLedger";
import { feeMoney, feeRateLabel, merchantTierLabels } from "../finance/finance-format";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function explainMerchantError(errorMsg: string) {
  if (errorMsg === "INVALID_STATE_TRANSITION") {
    return "Cửa hàng đã ở trạng thái này hoặc chuyển đổi trạng thái không hợp lệ.";
  }
  if (errorMsg === "MERCHANT_NOT_FOUND") {
    return "Không tìm thấy cửa hàng.";
  }
  if (errorMsg === "FORBIDDEN") {
    return "Bạn không có quyền thực hiện thao tác kiểm duyệt cửa hàng.";
  }
  if (errorMsg === "INVALID_INPUT") {
    return "Lý do là bắt buộc (từ 1 đến 255 ký tự).";
  }
  return errorMsg || "Đã xảy ra lỗi khi cập nhật trạng thái cửa hàng.";
}

export function AdminMerchants() {
  const { accessToken } = useAuthSession();
  const resource = useResource(
    () => commerce.listAdminMerchants(accessToken!).then(({ merchants }) => merchants),
    [accessToken],
  );

  const [actionTarget, setActionTarget] = useState<{
    id: number;
    name: string;
    nextActive: boolean;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  async function handleConfirmStatusChange(reason: string) {
    if (!actionTarget || !accessToken) return;
    setActionBusy(true);
    setActionError(null);

    try {
      const response = await commerce.changeAdminMerchantStatus(
        actionTarget.id,
        { isActive: actionTarget.nextActive, reason },
        accessToken,
      );

      // Update in cached resource data
      resource.setData((prev) =>
        prev
          ? prev.map((m) => (m.id === actionTarget.id ? { ...m, isActive: response.merchant.isActive } : m))
          : null,
      );

      setActionNotice(
        `Đã ${actionTarget.nextActive ? "kích hoạt" : "tạm ngưng"} cửa hàng "${response.merchant.name}" thành công.`,
      );
      setActionTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Thao tác thất bại.";
      setActionError(explainMerchantError(msg));
    } finally {
      setActionBusy(false);
    }
  }

  const merchants = resource.data ?? [];

  return (
    <>
      <PageHeader
        title="Danh sách cửa hàng"
        description="Quản lý và kiểm duyệt trạng thái hoạt động của các đối tác Merchant."
      />

      {actionNotice && (
        <div
          role="status"
          className="mb-5 flex items-center justify-between rounded-2xl bg-[#edf4e9] p-4 text-sm font-semibold text-[#376743]"
        >
          <div className="flex items-center gap-2">
            <CheckCircle size={18} />
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-xs underline hover:no-underline"
          >
            Đóng
          </button>
        </div>
      )}

      {resource.loading ? (
        <LoadingState cards={3} />
      ) : resource.error ? (
        <ErrorState message={explainMerchantError(resource.error)} retry={resource.reload} />
      ) : !merchants.length ? (
        <EmptyState title="Chưa có cửa hàng" description="Danh sách cửa hàng sẽ xuất hiện tại đây." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label="Danh sách cửa hàng">
            <thead className="text-xs muted">
              <tr className="border-b border-[#e1e9e0]">
                {["Cửa hàng", "Doanh thu xét hạng", "Hạng", "Tỷ lệ phí", "Trạng thái", "Thao tác"].map(
                  (heading) => (
                    <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3">
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {merchants.map((merchant) => {
                const isActive = merchant.isActive !== false;
                const tier = merchant.financeTier;
                return (
                  <tr key={merchant.id} className="border-b border-[#edf2eb] last:border-0">
                    <th scope="row" className="min-w-40 px-4 py-4">
                      <h2 className="text-base font-extrabold text-[#233829]">{merchant.name}</h2>
                      <p className="mt-1 text-xs muted">
                        {merchant.slug} · #{merchant.id}
                      </p>
                    </th>

                    <td className="whitespace-nowrap px-4 py-4 tabular-nums">
                      {tier ? (
                        <>
                          {feeMoney(tier.revenueVnd)}{" "}
                          <span className="block text-xs muted">Năm {tier.year}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-4">{tier ? merchantTierLabels[tier.level] : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-4">{tier ? feeRateLabel(tier.feeRate) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {isActive ? (
                        <StatusText tone="green">Hoạt động</StatusText>
                      ) : (
                        <StatusText tone="amber">Tạm ngưng</StatusText>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {accessToken && tier && (
                          <AdminFeeDialog
                            token={accessToken}
                            merchantId={merchant.id}
                            merchantName={merchant.name}
                          />
                        )}

                        {isActive ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setActionTarget({
                                id: merchant.id,
                                name: merchant.name,
                                nextActive: false,
                              })
                            }
                            title={`Tạm ngưng ${merchant.name}`}
                          >
                            <ShieldWarning size={15} /> Tạm ngưng
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setActionTarget({
                                id: merchant.id,
                                name: merchant.name,
                                nextActive: true,
                              })
                            }
                            title={`Kích hoạt lại ${merchant.name}`}
                          >
                            <CheckCircle size={15} /> Kích hoạt
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Confirmation & Reason Dialog */}
      {actionTarget && (
        <AdminReasonDialog
          open={actionTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setActionTarget(null);
              setActionError(null);
            }
          }}
          title={actionTarget.nextActive ? "Kích hoạt lại cửa hàng?" : "Tạm ngưng hoạt động cửa hàng?"}
          description={
            actionTarget.nextActive
              ? `Kích hoạt lại "${actionTarget.name}" sẽ cho phép Merchant truy cập lại các tính năng quản lý.`
              : `Tạm ngưng "${actionTarget.name}" sẽ chặn các yêu cầu và thao tác đối với cửa hàng này.`
          }
          confirmLabel={actionTarget.nextActive ? "Xác nhận kích hoạt" : "Xác nhận tạm ngưng"}
          destructive={!actionTarget.nextActive}
          busy={actionBusy}
          error={actionError ?? undefined}
          onConfirm={handleConfirmStatusChange}
        />
      )}
    </>
  );
}

export function AdminFeeDialog({
  token,
  merchantId,
  merchantName,
  buttonLabel = "Chi tiết sổ phí",
}: {
  token: string;
  merchantId: number;
  merchantName: string;
  buttonLabel?: string;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button type="button" size="sm" variant="outline">
          {buttonLabel}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl p-5 shadow-2xl outline-none sm:p-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Dialog.Title className="text-xl font-extrabold">Sổ phí · {merchantName}</Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" size="sm" variant="ghost">
                Đóng
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Hạng và lịch sử giao dịch phí của {merchantName}.
          </Dialog.Description>
          <PlatformFeeLedger token={token} adminMerchantId={merchantId} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
