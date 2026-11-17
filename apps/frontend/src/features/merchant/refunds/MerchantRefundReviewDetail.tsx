import { useEffect, useState } from "react";
import { Alert, Button, Card, Descriptions, Flex, Input, Space, Spin, Typography, type TableColumnsType } from "antd";
import { createRefundsClient, translateRefundRequestError } from "../../../api/refunds-client";
import type { ExtendedRefundPreviewDto, RefundRequestDetailResponse, RefundRequestStatus } from "../../../api/refunds-types";
import { CmsDataTable, CmsDetailLayout, CmsStatusTag } from "../cms";
import { isRefundAwaitingMerchant, refundRequestStatusLabel } from "../../refunds/refund-status";
import { challengeRewardStateLabel } from "../challenges/challenge-labels";

const api = createRefundsClient();
const money = (value: string) => `${Number(value).toLocaleString("vi-VN")} ₫`;
const formatPts = (value: string) => Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 });

type Props = {
  requestId: number;
  token: string;
  onClose(): void;
  onUpdated(status: RefundRequestStatus): void;
};

type PreviewRow = { key: string; metric: string; before: string; after: string };

function RefundPreview({ preview }: { preview: ExtendedRefundPreviewDto }) {
  const rows: PreviewRow[] = [
    { key: "amount", metric: "Số tiền hoàn", before: "0 ₫", after: money(preview.refundAmountVnd) },
    {
      key: "available",
      metric: "Điểm khả dụng",
      before: String(preview.walletBefore.availablePoints ?? "—"),
      after: `${preview.walletAfter.availablePoints ?? "—"} (nợ ${preview.walletAfter.pointDebt ?? "—"}, dư ${preview.walletAfter.fractionalCarry ?? "—"})`,
    },
    {
      key: "lifetime",
      metric: "Điểm tích lũy trọn đời",
      before: String(preview.walletBefore.netLifetimeEarned ?? "—"),
      after: String(preview.walletAfter.netLifetimeEarned ?? "—"),
    },
    { key: "tier", metric: "Hạng thành viên", before: preview.tierBefore, after: preview.tierAfter },
    {
      key: "voucher",
      metric: "Voucher giảm giá",
      before: "—",
      after: preview.discountVoucherRestorable ? "Khôi phục" : "Không thay đổi",
    },
  ];
  const columns: TableColumnsType<PreviewRow> = [
    { title: "Chỉ số", dataIndex: "metric", key: "metric" },
    { title: "Hiện tại", dataIndex: "before", key: "before" },
    { title: "Dự kiến sau hoàn tiền", dataIndex: "after", key: "after" },
  ];
  const challengeRows = (preview.challenges ?? []).map((challenge) => ({
    key: String(challenge.challengeId),
    metric: `Nhiệm vụ: ${challenge.title}`,
    before: `${challenge.currentValueBefore} · ${challengeRewardStateLabel(challenge.rewardStateBefore)} · ${formatPts(challenge.budgetSpentBefore)} điểm`,
    after: `${challenge.currentValueAfter} · ${challengeRewardStateLabel(challenge.rewardStateAfter)} · ${formatPts(challenge.budgetSpentAfter)} điểm`,
  }));

  return (
    <Space orientation="vertical" size={12} className="w-full">
      <CmsDataTable label="Tác động dự kiến" rows={rows} columns={columns} rowKey="key" />
      {challengeRows.length > 0 ? (
        <CmsDataTable label="Tác động đến nhiệm vụ" rows={challengeRows} columns={columns} rowKey="key" />
      ) : null}
    </Space>
  );
}

export function MerchantRefundReviewDetail({ requestId, token, onClose, onUpdated }: Props) {
  const [data, setData] = useState<RefundRequestDetailResponse | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api.getMerchantRefundRequest(requestId, token).then((result) => {
      if (active) setData(result);
    }).catch((cause: unknown) => {
      if (active) setError(translateRefundRequestError(cause instanceof Error ? cause.message : "INVALID_INPUT"));
    });
    return () => { active = false; };
  }, [requestId, token]);

  async function decide(action: "approve" | "reject") {
    if (busy || (action === "reject" && !note.trim())) return;
    setBusy(true);
    setError("");
    try {
      const { refundRequest } = action === "approve"
        ? await api.approveMerchantRefundRequest(requestId, token, note.trim() || undefined)
        : await api.rejectMerchantRefundRequest(requestId, note.trim(), token);
      onUpdated(refundRequest.status);
    } catch (cause) {
      setError(translateRefundRequestError(cause instanceof Error ? cause.message : "INVALID_INPUT"));
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) return <Flex justify="center" className="py-12"><Spin description="Đang tải yêu cầu hoàn tiền…" /></Flex>;
  if (error && !data) return <Alert type="error" showIcon message="Không tải được yêu cầu hoàn tiền" description={error} action={<Button onClick={onClose}>Quay lại danh sách</Button>} />;
  if (!data) return null;

  const pending = isRefundAwaitingMerchant(data.refundRequest.status);
  const providerRequired = data.preview.providerConfirmationRequired;
  const statusTone = data.refundRequest.status === "COMPLETED"
    ? "success"
    : data.refundRequest.status === "REJECTED" || data.refundRequest.status === "FAILED"
      ? "error"
      : pending || data.refundRequest.status === "PROCESSING"
        ? "warning"
        : "info";
  const orderColumns: TableColumnsType<RefundRequestDetailResponse["order"]["items"][number]> = [
    { title: "Sản phẩm", dataIndex: "productName", key: "productName" },
    { title: "Số lượng", dataIndex: "quantity", key: "quantity", align: "right", width: 110 },
    { title: "Đơn giá", dataIndex: "unitPrice", key: "unitPrice", align: "right", render: (value: string) => money(value) },
    { title: "Thành tiền", dataIndex: "lineTotal", key: "lineTotal", align: "right", render: (value: string) => money(value) },
  ];

  return (
    <CmsDetailLayout
      title={`Yêu cầu hoàn tiền #${requestId}`}
      backTo="/merchant/refund-requests"
      backLabel="Quay lại yêu cầu hoàn tiền"
      status={<CmsStatusTag label={refundRequestStatusLabel(data.refundRequest.status)} tone={statusTone} />}
    >
      {error ? <Alert type="error" showIcon message={error} className="mb-4" /> : null}
      <Card title="Thông tin yêu cầu" size="small">
        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label="Đơn hàng">#{data.order.id}</Descriptions.Item>
          <Descriptions.Item label="Thành viên">{data.member?.email ?? `#${data.order.memberId}`}</Descriptions.Item>
          <Descriptions.Item label="Tổng tiền">{money(data.order.total)}</Descriptions.Item>
          <Descriptions.Item label="Gửi lúc">{new Date(data.refundRequest.requestedAt).toLocaleString("vi-VN")}</Descriptions.Item>
          <Descriptions.Item label="Lý do" span={{ xs: 1, sm: 2, lg: 3 }}>{data.refundRequest.reason}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="Sản phẩm trong đơn" size="small">
        <CmsDataTable label="Sản phẩm trong đơn" rows={data.order.items} columns={orderColumns} rowKey="productId" />
      </Card>
      {pending ? (
        <Card title="Tác động dự kiến khi hoàn tiền" size="small">
          <Typography.Paragraph type="secondary" className="!mb-3">
            Thông tin này do hệ thống tính trước. Quyết định chỉ được gửi sau khi bạn xác nhận.
          </Typography.Paragraph>
          <RefundPreview preview={data.preview} />
          {providerRequired ? (
            <Alert className="mt-4" type="warning" showIcon message="Chưa thể hoàn qua VNPay" description="Đơn đã thanh toán qua VNPay. Hệ thống chưa hỗ trợ hoàn tiền qua cổng này." />
          ) : null}
        </Card>
      ) : (
        <Card title="Kết quả xử lý" size="small">
          <Typography.Paragraph className="!mb-0">
            {data.refundRequest.adminDecisionReason ?? data.refundRequest.merchantDecisionReason ?? refundRequestStatusLabel(data.refundRequest.status)}
          </Typography.Paragraph>
        </Card>
      )}
      {pending ? (
        <Card title="Quyết định" size="small">
          <Space orientation="vertical" size={12} className="w-full">
            <Input.TextArea
              aria-label="Ghi chú hoặc lý do từ chối"
              maxLength={255}
              disabled={busy || confirming}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nhập ghi chú; bắt buộc khi từ chối"
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
            {confirming ? (
              <Alert
                type="warning"
                showIcon
                message={`Xác nhận hoàn ${money(data.preview.refundAmountVnd)} cho đơn #${data.order.id}?`}
                description="Hành động này sẽ gửi yêu cầu hoàn tiền để hệ thống xử lý."
                action={
                  <Flex gap={8} wrap>
                    <Button disabled={busy} onClick={() => setConfirming(false)}>Quay lại</Button>
                    <Button type="primary" loading={busy} onClick={() => void decide("approve")}>Xác nhận hoàn tiền</Button>
                  </Flex>
                }
              />
            ) : (
              <Flex gap={8} wrap>
                <Button danger disabled={busy || !note.trim()} onClick={() => void decide("reject")}>Từ chối</Button>
                <Button type="primary" disabled={busy || providerRequired} onClick={() => setConfirming(true)}>Duyệt hoàn tiền</Button>
              </Flex>
            )}
          </Space>
        </Card>
      ) : null}
    </CmsDetailLayout>
  );
}
