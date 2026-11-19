import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DotsThreeVertical } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import type { MerchantChallengeDto } from "../../../api/challenges-types";

export type MerchantChallengeAction = "archive" | "feature" | "delete";

export function MerchantChallengeActions({
  challenge,
  onAction,
}: {
  challenge: MerchantChallengeDto;
  onAction(action: MerchantChallengeAction): void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Thao tác nhiệm vụ ${challenge.title}`}
          className="inline-grid size-10 shrink-0 place-items-center rounded-full border border-[#e4eae2] bg-white text-[#4e6253] transition hover:bg-[#f1f6ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8cdb0]"
        >
          <DotsThreeVertical size={20} weight="bold" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="surface z-50 min-w-52 rounded-2xl p-1.5 shadow-xl"
        >
          <DropdownMenu.Item
            asChild
            className="cursor-pointer rounded-xl px-3 py-2.5 text-sm outline-none hover:bg-[#edf4e9] focus:bg-[#edf4e9]"
          >
            <Link to={`/merchant/challenges/${challenge.id}/edit`}>Chỉnh sửa nhiệm vụ</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-[#edf1ea]" />
          {challenge.status !== "ARCHIVED" && (
            <DropdownMenu.Item
              className="cursor-pointer rounded-xl px-3 py-2.5 text-sm outline-none hover:bg-[#edf4e9] focus:bg-[#edf4e9]"
              onSelect={() => onAction("archive")}
            >
              Lưu trữ
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            className="cursor-pointer rounded-xl px-3 py-2.5 text-sm outline-none hover:bg-[#edf4e9] focus:bg-[#edf4e9]"
            onSelect={() => onAction("feature")}
          >
            {challenge.isFeatured ? "Bỏ nổi bật" : "Đặt làm nổi bật"}
          </DropdownMenu.Item>
          {!challenge.hasProgress && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-[#edf1ea]" />
              <DropdownMenu.Item
                className="cursor-pointer rounded-xl px-3 py-2.5 text-sm text-red-700 outline-none hover:bg-red-50 focus:bg-red-50"
                onSelect={() => onAction("delete")}
              >
                Xóa nhiệm vụ
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
