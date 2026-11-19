import { useState } from "react";
import { createChallengesClient, translateChallengeError } from "../../../api/challenges-client";
import type { MerchantChallengeDto } from "../../../api/challenges-types";
import { Button } from "../../../components/ui";
import { ConfirmActionDialog } from "../../../components/ui/ConfirmActionDialog";

const api = createChallengesClient();

export function MerchantChallengeStatusAction({
  challenge,
  token,
  onSuccess,
}: {
  challenge: MerchantChallengeDto;
  token: string;
  onSuccess(): void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (challenge.effectiveStatus === "ENDED" || challenge.effectiveStatus === "ARCHIVED") return null;

  const isActive = challenge.status === "ACTIVE";
  const action = isActive ? "pause" : "activate";
  const label = isActive ? "Tạm dừng" : "Kích hoạt";

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (action === "activate") await api.activateMerchantChallenge(challenge.id, token);
      else await api.pauseMerchantChallenge(challenge.id, token);
      setOpen(false);
      onSuccess();
    } catch (reason) {
      setError(translateChallengeError(reason instanceof Error ? reason.message : "INVALID_INPUT"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={isActive ? "outline" : "secondary"}
        aria-label={`${label} nhiệm vụ ${challenge.title}`}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <ConfirmActionDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setError("");
        }}
        title={isActive ? "Tạm dừng nhiệm vụ?" : "Kích hoạt nhiệm vụ?"}
        description={
          isActive
            ? "Nhiệm vụ sẽ tạm ngừng nhận tiến độ mới. Tiến độ và các lượt chờ ngân sách được giữ lại."
            : "Nhiệm vụ sẽ bắt đầu nhận các hoạt động đủ điều kiện. Các lượt đã chờ ngân sách cũng có thể được cấp thưởng."
        }
        confirmLabel={label}
        busy={busy}
        error={error}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
