import { useRef, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DotsThreeVertical, Eye, EyeSlash, PencilSimple } from "@phosphor-icons/react";
import { createCommerceClient } from "../../api/commerce-http";
import type {
  InventorySummaryDto,
  VoucherDefinitionDto,
  VoucherDefinitionPatch,
} from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { Button, BusyLabel, ErrorState, Field, Input, Textarea } from "../../components/ui";
import { money } from "../../lib/utils";
import { InventoryPanel, type InventoryAdjustment } from "./InventoryPanel";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const menuItem =
  "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none hover:bg-[#edf4e9] focus:bg-[#edf4e9] data-disabled:pointer-events-none data-disabled:opacity-50";

type InventoryMode = "adjust" | "history";
const dialogTitles = {
  edit: "Chỉnh sửa voucher",
  adjust: "Điều chỉnh lượt phát hành",
  history: "Lịch sử phát hành",
};
type RowProps = {
  definition: VoucherDefinitionDto;
  token: string;
  statusBusy: boolean;
  onToggle(): void;
  onDefinitionChange(definition: VoucherDefinitionDto): void;
  onInventoryChange(quantity: number): void;
};

export function MerchantVoucherTableRow({
  definition,
  token,
  statusBusy,
  onToggle,
  onDefinitionChange,
  onInventoryChange,
}: RowProps) {
  const [mode, setMode] = useState<keyof typeof dialogTitles | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const isDiscount = definition.type === "DISCOUNT";
  const terms =
    isDiscount && definition.discountAmount
      ? money(Number(definition.discountAmount))
      : definition.rewardDescription;

  async function adjustInventory({ direction, quantity, reason }: InventoryAdjustment) {
    const fingerprint = JSON.stringify([direction, quantity, reason]);
    if (request.current?.fingerprint !== fingerprint) {
      request.current = {
        fingerprint,
        key:
          globalThis.crypto?.randomUUID?.() ??
          `voucher-stock-${definition.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
    }
    setDialogBusy(true);
    try {
      const { inventory } = await api.adjustVoucherInventory(
        definition.id,
        direction,
        { quantity, reason },
        token,
        request.current.key,
      );
      request.current = null;
      onInventoryChange(inventory.availableQuantity);
      return inventory;
    } finally {
      setDialogBusy(false);
    }
  }

  async function saveDefinition(patch: VoucherDefinitionPatch) {
    setDialogBusy(true);
    try {
      const result = await api.updateVoucherDefinition(definition.id, patch, token);
      onDefinitionChange(result.definition);
      setMode(null);
    } finally {
      setDialogBusy(false);
    }
  }

  return (
    <>
      <tr className="border-t border-[#edf1ea] align-middle">
        <th scope="row" className="break-words px-5 py-4 font-bold text-[#20392a]">
          {definition.title}
          {terms && <span className="mt-1 block text-xs font-normal muted">{terms}</span>}
        </th>
        <td className="px-4 py-4 text-sm">{isDiscount ? "Giảm giá" : "Quà tặng"}</td>
        <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold">
          {definition.pointsCost.toLocaleString("vi-VN")} điểm
        </td>
        <td className="px-4 py-4 text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="whitespace-nowrap">
              <b>{definition.availableQuantity ?? "—"}</b>{" "}
              <span className="text-xs muted">{isDiscount ? "lượt còn lại" : "quà còn lại"}</span>
            </span>
            {isDiscount && (
              <span className="whitespace-nowrap">
                <b>{definition.issuedQuantity ?? "—"}</b> <span className="text-xs muted">đã phát hành</span>
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-4">
          <span
            className={
              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold " +
              (definition.isActive ? "bg-[#edf4e9] text-[#357044]" : "bg-[#fff3dd] text-[#97682a]")
            }
          >
            {definition.isActive ? "Đang hoạt động" : "Đã tắt"}
          </span>
        </td>
        <td className="px-4 py-4 text-right">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                ref={trigger}
                type="button"
                aria-label={"Thao tác voucher " + definition.title}
                className="inline-grid h-9 w-9 place-items-center rounded-full text-[#516357] hover:bg-[#edf3e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8eae91]"
              >
                <DotsThreeVertical size={20} weight="bold" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="surface z-50 min-w-48 rounded-2xl p-1.5 shadow-xl"
              >
                {isDiscount && (
                  <>
                    <DropdownMenu.Item className={menuItem} onSelect={() => setMode("adjust")}>
                      Điều chỉnh lượt phát hành
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className={menuItem} onSelect={() => setMode("history")}>
                      Lịch sử phát hành
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="my-1 h-px bg-[#edf1ea]" />
                  </>
                )}
                <DropdownMenu.Item
                  className={menuItem}
                  disabled={statusBusy}
                  onSelect={() => setMode("edit")}
                >
                  <PencilSimple size={16} /> Chỉnh sửa voucher
                </DropdownMenu.Item>
                <DropdownMenu.Item className={menuItem} disabled={statusBusy} onSelect={onToggle}>
                  {definition.isActive ? <EyeSlash size={16} /> : <Eye size={16} />}
                  {definition.isActive ? "Tắt voucher" : "Bật voucher"}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </td>
      </tr>
      <Dialog.Root
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open && !dialogBusy) setMode(null);
        }}
      >
        {mode && (
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
            <Dialog.Content
              className="surface fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl p-6 shadow-2xl outline-none sm:p-7"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                trigger.current?.focus();
              }}
            >
              <Dialog.Title className="text-xl font-extrabold text-[#20392a]">
                {dialogTitles[mode]}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm muted">{definition.title}</Dialog.Description>
              {mode === "edit" ? (
                <VoucherEditForm definition={definition} busy={dialogBusy} onSave={saveDefinition} />
              ) : (
                <>
                  <div className="mt-5">
                    <VoucherInventory
                      definitionId={definition.id}
                      token={token}
                      mode={mode}
                      onAdjust={adjustInventory}
                    />
                  </div>
                  <div className="mt-5 flex justify-end">
                    <Dialog.Close asChild>
                      <Button variant="outline" disabled={dialogBusy}>
                        Đóng
                      </Button>
                    </Dialog.Close>
                  </div>
                </>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </Dialog.Root>
    </>
  );
}

function VoucherEditForm({
  definition,
  busy,
  onSave,
}: {
  definition: VoucherDefinitionDto;
  busy: boolean;
  onSave(patch: VoucherDefinitionPatch): Promise<void>;
}) {
  const [title, setTitle] = useState(definition.title);
  const [pointsCost, setPointsCost] = useState(String(definition.pointsCost));
  const [discountAmount, setDiscountAmount] = useState(definition.discountAmount ?? "");
  const [rewardDescription, setRewardDescription] = useState(definition.rewardDescription ?? "");
  const [error, setError] = useState("");
  const isDiscount = definition.type === "DISCOUNT";
  const isLegacyReward = !isDiscount && definition.rewardProductId === null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const name = title.trim();
    const description = rewardDescription.trim();
    if (!name || (isLegacyReward && !description)) {
      setError(!name ? "Vui lòng nhập tên voucher." : "Vui lòng nhập mô tả quà tặng.");
      return;
    }
    setError("");
    try {
      await onSave({
        title: name,
        pointsCost: Number(pointsCost),
        ...(isDiscount ? { discountAmount } : {}),
        ...(isLegacyReward ? { rewardDescription: description } : {}),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật voucher.");
    }
  }

  return (
    <form className="mt-5 grid gap-4" onSubmit={submit}>
      <Field label="Tên voucher">
        <Input
          required
          disabled={busy}
          maxLength={191}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field label="Điểm cần đổi">
        <Input
          required
          disabled={busy}
          type="number"
          min={1}
          max={2147483647}
          step={1}
          value={pointsCost}
          onChange={(event) => setPointsCost(event.target.value)}
        />
      </Field>
      {isDiscount && (
        <Field label="Số tiền giảm (VND)">
          <Input
            required
            disabled={busy}
            inputMode="numeric"
            pattern="[1-9][0-9]{0,14}"
            value={discountAmount}
            onChange={(event) => setDiscountAmount(event.target.value)}
          />
        </Field>
      )}
      {isLegacyReward && (
        <Field label="Mô tả quà tặng">
          <Textarea
            required
            disabled={busy}
            maxLength={1000}
            value={rewardDescription}
            onChange={(event) => setRewardDescription(event.target.value)}
          />
        </Field>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#a4473a]">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Dialog.Close asChild>
          <Button type="button" variant="outline" disabled={busy}>
            Hủy
          </Button>
        </Dialog.Close>
        <Button type="submit" disabled={busy}>
          {busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu voucher"}
        </Button>
      </div>
    </form>
  );
}

function VoucherInventory({
  definitionId,
  token,
  mode,
  onAdjust,
}: {
  definitionId: number;
  token: string;
  mode: InventoryMode;
  onAdjust(adjustment: InventoryAdjustment): Promise<InventorySummaryDto>;
}) {
  const resource = useResource(() => api.getVoucherInventory(definitionId, token), [definitionId, token]);
  if (resource.loading)
    return (
      <p role="status" className="text-sm muted">
        Đang tải lượt phát hành…
      </p>
    );
  if (resource.error || !resource.data) {
    return (
      <ErrorState message={resource.error ?? "Không tải được lượt phát hành."} retry={resource.reload} />
    );
  }
  return (
    <InventoryPanel
      balance={resource.data.inventory}
      movements={resource.data.movements}
      mode={mode}
      subject="voucher"
      onAdjust={async (input) => {
        const inventory = await onAdjust(input);
        resource.setData((current) => (current ? { ...current, inventory } : null));
      }}
    />
  );
}
