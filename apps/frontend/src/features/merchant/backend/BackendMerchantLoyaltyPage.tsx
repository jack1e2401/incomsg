import { useState, type FormEvent } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import type {
  LoyaltyConfigInput,
  MerchantLoyaltyPreviewResponse,
  TierLevel,
} from "../../../api/commerce-types";
import { useResource } from "../../../api/useResource";
import { LoyaltyFormula } from "../../../components/LoyaltyFormula";
import {
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
} from "../../../components/ui";
import { MerchantLoyaltyTransactions } from "../MerchantLoyaltyTransactions";
import { MerchantLoyaltyHistory } from "../MerchantLoyaltyHistory";
import { MerchantLoyaltyMembers } from "../MerchantLoyaltyMembers";
import { api, formatPrice, message, useToken } from "../merchant-page-support";

export function MerchantLoyalty() {
  const token = useToken();
  const resource = useResource(() => api.getLoyaltyConfig(token), [token]);
  const history = useResource(() => api.getLoyaltyPolicyHistory(token), [token]);
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const activeTab = pathname.endsWith("/transactions")
    ? "ledger"
    : pathname.endsWith("/history")
      ? "history"
      : pathname.endsWith("/members")
        ? "members"
        : "config";
  const [draft, setDraft] = useState<LoyaltyConfigInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Formula preview state
  const [previewAmount, setPreviewAmount] = useState("");
  const [previewTier, setPreviewTier] = useState<TierLevel | "">("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewResult, setPreviewResult] = useState<MerchantLoyaltyPreviewResponse | null>(null);

  const config = resource.data?.config;
  const form =
    draft ??
    (config
      ? {
          vndPerPoint: config.vndPerPoint,
          isActive: config.isActive,
          tiers: config.tiers.map((tier) => ({ ...tier })),
        }
      : null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.putLoyaltyConfig(form, token);
      resource.setData(result);
      history.reload();
      setDraft(null);
      setNotice("Đã lưu cấu hình.");
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  async function runFormulaPreview() {
    if (!previewAmount || previewBusy) return;
    setPreviewBusy(true);
    setPreviewError("");
    try {
      const result = await api.previewMerchantLoyalty(
        {
          netOrderAmountVnd: previewAmount,
          ...(previewTier ? { tierLevel: previewTier } : {}),
        },
        token,
      );
      setPreviewResult(result);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Không thể tính thử điểm");
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={
          activeTab === "ledger"
            ? "Giao dịch điểm"
            : activeTab === "history"
              ? "Lịch sử chính sách"
              : activeTab === "members"
                ? "Thành viên"
                : "Cấu hình điểm"
        }
      />

      {activeTab === "config" ? (
        resource.loading ? (
          <LoadingState cards={2} />
        ) : resource.error ? (
          <ErrorState message={resource.error} retry={resource.reload} />
        ) : !config || !form ? (
          <EmptyState title="Chưa có cấu hình" description="Cấu hình chưa khả dụng." />
        ) : (
          <div className="space-y-6 max-w-4xl">
            <div className="rounded-2xl bg-[#fff8eb] p-4 text-xs leading-5 text-[#97682a]">
              <p className="font-bold">
                Lưu ý: Thay đổi tỷ lệ hoặc hạng tích điểm chỉ áp dụng cho các đơn hàng phát sinh sau này.
              </p>
              <p className="mt-1">
                Số dư điểm hiện tại và phần điểm lẻ của hội viên sẽ được bảo lưu nguyên vẹn.
              </p>
            </div>

            <Card className="p-6 sm:p-8">
              <LoyaltyFormula config={config} />
              <form onSubmit={save} className="mt-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="VND cho mỗi điểm">
                    <Input
                      required
                      type="number"
                      min={1}
                      step={1}
                      value={form.vndPerPoint}
                      onChange={(event) => setDraft({ ...form, vndPerPoint: Number(event.target.value) })}
                    />
                  </Field>
                  <Field label="Quy tắc tích điểm">
                    <Select
                      value={form.isActive ? "true" : "false"}
                      onChange={(event) => setDraft({ ...form, isActive: event.target.value === "true" })}
                    >
                      <option value="true">Hoạt động</option>
                      <option value="false">Tạm dừng</option>
                    </Select>
                  </Field>
                </div>
                <div>
                  <h2 className="font-extrabold">Các hạng</h2>
                  <p className="mt-1 text-xs muted">
                    Ngưỡng Bronze cố định ở 0. Nhập ngưỡng tăng dần và hệ số ở dạng 1.00.
                  </p>
                  <div className="mt-4 space-y-3">
                    {form.tiers.map((tier, index) => (
                      <div
                        key={tier.level}
                        className="grid items-end gap-3 rounded-xl bg-[#f7f9f5] p-4 sm:grid-cols-[1fr_1fr_1fr]"
                      >
                        <p className="pb-3 text-sm font-extrabold">{tier.level}</p>
                        <Field label="Điểm tích lũy tối thiểu">
                          <Input
                            required
                            type="number"
                            min={index === 0 ? 0 : 1}
                            step={1}
                            disabled={index === 0}
                            value={tier.minLifetimePoints}
                            onChange={(event) =>
                              setDraft({
                                ...form,
                                tiers: form.tiers.map((item, i) =>
                                  i === index
                                    ? { ...item, minLifetimePoints: Number(event.target.value) }
                                    : item,
                                ),
                              })
                            }
                          />
                        </Field>
                        <Field label="Hệ số">
                          <Input
                            required
                            pattern="[0-9]{1,3}\.[0-9]{2}"
                            value={tier.multiplier}
                            onChange={(event) =>
                              setDraft({
                                ...form,
                                tiers: form.tiers.map((item, i) =>
                                  i === index ? { ...item, multiplier: event.target.value } : item,
                                ),
                              })
                            }
                          />
                        </Field>
                      </div>
                    ))}
                  </div>
                </div>
                {error && (
                  <p role="alert" className="text-sm text-[#a4473a]">
                    {error}
                  </p>
                )}
                {notice && (
                  <p role="status" className="text-sm text-[#357044]">
                    {notice}
                  </p>
                )}
                <Button disabled={busy}>{busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu cấu hình"}</Button>
              </form>
            </Card>

            <Card className="p-6 sm:p-8">
              <h2 className="text-lg font-extrabold">Xem trước công thức tích điểm</h2>
              <p className="mt-1 text-xs muted">
                Thử tính toán điểm số cho đơn hàng dựa trên công thức hiện tại mà không thay đổi dữ liệu.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Số tiền đơn hàng thử nghiệm (VNĐ)">
                  <Input
                    required
                    type="number"
                    min={1}
                    aria-label="Số tiền đơn hàng thử nghiệm"
                    value={previewAmount}
                    onChange={(event) => setPreviewAmount(event.target.value)}
                    placeholder="50000"
                  />
                </Field>
                <Field label="Hạng thành viên (tùy chọn)">
                  <Select
                    value={previewTier}
                    onChange={(event) => setPreviewTier(event.target.value as TierLevel | "")}
                  >
                    <option value="">Theo cấu hình</option>
                    <option value="BRONZE">BRONZE</option>
                    <option value="SILVER">SILVER</option>
                    <option value="GOLD">GOLD</option>
                    <option value="PLATINUM">PLATINUM</option>
                  </Select>
                </Field>
                <div className="flex items-end">
                  <Button
                    type="button"
                    disabled={previewBusy || !previewAmount}
                    onClick={() => void runFormulaPreview()}
                  >
                    {previewBusy ? <BusyLabel>Đang tính</BusyLabel> : "Tính thử điểm"}
                  </Button>
                </div>
              </div>

              {previewError && (
                <p role="alert" className="mt-3 text-xs text-[#a4473a]">
                  {previewError}
                </p>
              )}

              {previewResult && (
                <div className="mt-4 rounded-xl bg-[#edf4e9] p-4 text-xs">
                  <p className="text-sm font-bold text-[#294833]">
                    Điểm ước tính:{" "}
                    <span className="font-mono text-base">{previewResult.estimatedPointsExact}</span> điểm
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[#46614d] sm:grid-cols-4">
                    <p>
                      Phần nguyên: <b>{previewResult.integerProjection}</b>
                    </p>
                    <p>
                      Phần lẻ: <b>{previewResult.fractionalProjection}</b>
                    </p>
                    <p>
                      Hệ số: <b>{previewResult.multiplier}×</b>
                    </p>
                    <p>
                      Tỷ lệ: <b>{formatPrice(String(previewResult.vndPerPoint))}/điểm</b>
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] text-[#637269]">
                    Làm tròn: {previewResult.rounding} · Độ chính xác: {previewResult.scale} chữ số thập phân
                  </p>
                </div>
              )}
            </Card>
          </div>
        )
      ) : activeTab === "ledger" ? (
        <MerchantLoyaltyTransactions />
      ) : activeTab === "members" ? (
        <MerchantLoyaltyMembers token={token} memberId={params.get("memberId")} />
      ) : history.loading ? (
        <LoadingState cards={2} />
      ) : history.error ? (
        <ErrorState message={history.error} retry={history.reload} />
      ) : (
        <Card className="max-w-4xl p-5 sm:p-7">
          <MerchantLoyaltyHistory versions={history.data?.versions ?? []} />
        </Card>
      )}
    </>
  );
}
