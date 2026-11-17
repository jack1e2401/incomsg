import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { VoucherDefinitionDto, VoucherDefinitionInput } from "../../../api/commerce-types";
import { useResource } from "../../../api/useResource";
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
import { MerchantVoucherTableRow } from "../MerchantVoucherTableRow";
import { api, message, useToken } from "../merchant-page-support";

export function MerchantVouchers() {
  const token = useToken();
  const resource = useResource(
    () => api.listMerchantVoucherDefinitions(token).then((response) => response.definitions),
    [token],
  );
  const [kind, setKind] = useState<VoucherDefinitionInput["type"] | "">("");
  const [title, setTitle] = useState("");
  const [pointsCost, setPointsCost] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [rewardProductId, setRewardProductId] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isReward = kind === "REWARD";
  const rewardProducts = useResource(
    () =>
      isReward
        ? api
            .listOwnProducts(token)
            .then(({ items }) =>
              items.filter((product) => product.kind === "REWARD" && product.status === "ACTIVE"),
            )
        : Promise.resolve([]),
    [token, isReward],
  );
  const selectedReward =
    rewardProducts.loading || rewardProducts.error
      ? undefined
      : rewardProducts.data?.find((product) => String(product.id) === rewardProductId);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kind || busy || (isReward && !selectedReward)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const terms = { title: title.trim(), pointsCost: Number(pointsCost) };
      const input: VoucherDefinitionInput =
        kind === "REWARD"
          ? { ...terms, type: kind, discountAmount: null, rewardProductId: Number(rewardProductId) }
          : {
              ...terms,
              type: kind,
              discountAmount,
              initialQuantity: Number(initialQuantity),
              rewardDescription: null,
            };
      const response = await api.createVoucherDefinition(input, token);
      resource.setData((current) => [...(current ?? []), response.definition]);
      setKind("");
      setTitle("");
      setPointsCost("");
      setDiscountAmount("");
      setInitialQuantity("0");
      setRewardProductId("");
      setNotice("Đã tạo voucher.");
    } catch (reason) {
      const failure = message(reason);
      if (failure === "REWARD_PRODUCT_NOT_FOUND") {
        setError("Sản phẩm đổi thưởng không còn khả dụng. Hãy chọn sản phẩm khác.");
        setRewardProductId("");
        rewardProducts.reload();
      } else {
        setError(failure);
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggle(definition: VoucherDefinitionDto) {
    if (busyId !== null) return;
    setBusyId(definition.id);
    setError("");
    setNotice("");
    try {
      const response = await api.updateVoucherDefinition(
        definition.id,
        { isActive: !definition.isActive },
        token,
      );
      updateDefinition(response.definition);
      setNotice("Đã cập nhật voucher.");
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusyId(null);
    }
  }

  function updateDefinition(definition: VoucherDefinitionDto) {
    resource.setData(
      (current) => current?.map((item) => (item.id === definition.id ? definition : item)) ?? null,
    );
  }

  return (
    <>
      <PageHeader title="Voucher" />
      <Card className="mb-6 max-w-3xl p-6 sm:p-8">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={create}>
          <Field label="Loại voucher">
            <Select
              required
              disabled={busy}
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
            >
              <option value="" disabled>
                Chọn loại voucher
              </option>
              <option value="DISCOUNT">Giảm giá</option>
              <option value="REWARD">Quà tặng</option>
            </Select>
          </Field>
          {kind && (
            <>
              <Field label="Tên voucher">
                <Input
                  required
                  maxLength={191}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
              <Field label="Điểm cần đổi">
                <Input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={pointsCost}
                  onChange={(event) => setPointsCost(event.target.value)}
                />
              </Field>
              {kind === "DISCOUNT" ? (
                <>
                  <Field label="Số tiền giảm (VND)">
                    <Input
                      required
                      inputMode="numeric"
                      pattern="[1-9][0-9]{0,14}"
                      value={discountAmount}
                      onChange={(event) => setDiscountAmount(event.target.value)}
                    />
                  </Field>
                  <Field label="Số lượt phát hành ban đầu">
                    <Input
                      required
                      type="number"
                      min={0}
                      max={2147483647}
                      step={1}
                      value={initialQuantity}
                      onChange={(event) => setInitialQuantity(event.target.value)}
                    />
                  </Field>
                </>
              ) : (
                <div>
                  <Field label="Sản phẩm đổi thưởng">
                    <Select
                      required
                      disabled={
                        busy ||
                        rewardProducts.loading ||
                        !!rewardProducts.error ||
                        !rewardProducts.data?.length
                      }
                      value={selectedReward ? rewardProductId : ""}
                      onChange={(event) => setRewardProductId(event.target.value)}
                    >
                      <option value="" disabled>
                        {rewardProducts.loading ? "Đang tải sản phẩm…" : "Chọn sản phẩm"}
                      </option>
                      {rewardProducts.data?.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · #{product.id}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {rewardProducts.error ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p role="alert" className="text-xs text-[#a4473a]">
                        Không tải được sản phẩm đổi thưởng.
                      </p>
                      <Button type="button" size="sm" variant="outline" onClick={rewardProducts.reload}>
                        Thử lại
                      </Button>
                    </div>
                  ) : !rewardProducts.loading && !rewardProducts.data?.length ? (
                    <p className="mt-2 text-xs muted">
                      Chưa có sản phẩm chỉ đổi thưởng đang hoạt động.{" "}
                      <Link to="/merchant/products" className="underline">
                        Quản lý sản phẩm
                      </Link>
                    </p>
                  ) : null}
                </div>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="sm:col-span-2 text-sm text-[#a4473a]">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="sm:col-span-2 text-sm text-[#357044]">
              {notice}
            </p>
          )}
          {kind && (
            <div className="sm:col-span-2">
              <Button disabled={busy || (isReward && !selectedReward)}>
                {busy ? <BusyLabel>Đang lưu</BusyLabel> : "Tạo voucher"}
              </Button>
            </div>
          )}
        </form>
      </Card>
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState
          title="Chưa có voucher"
          description="Tạo voucher đầu tiên cho chương trình của cửa hàng."
        />
      ) : (
        <div className="surface overflow-x-auto rounded-3xl">
          <table
            aria-label="Danh sách voucher"
            className="w-full min-w-[760px] table-fixed border-collapse text-left"
          >
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[23%]" />
              <col className="w-[16%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="bg-[#f7f9f5] text-xs font-bold uppercase tracking-wide text-[#65746a]">
              <tr>
                <th scope="col" className="px-5 py-4">
                  Voucher
                </th>
                <th scope="col" className="px-4 py-4">
                  Loại
                </th>
                <th scope="col" className="px-4 py-4">
                  Điểm đổi
                </th>
                <th scope="col" className="px-4 py-4">
                  Số lượng
                </th>
                <th scope="col" className="px-4 py-4">
                  Trạng thái
                </th>
                <th scope="col" className="px-4 py-4">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {resource.data.map((definition) => (
                <MerchantVoucherTableRow
                  key={definition.id}
                  definition={definition}
                  token={token}
                  statusBusy={busyId !== null}
                  onToggle={() => void toggle(definition)}
                  onDefinitionChange={updateDefinition}
                  onInventoryChange={(availableQuantity) =>
                    resource.setData(
                      (current) =>
                        current?.map((item) =>
                          item.id === definition.id ? { ...item, availableQuantity } : item,
                        ) ?? null,
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
