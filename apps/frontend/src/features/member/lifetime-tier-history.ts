import type { WalletTransactionDto } from "../../api/commerce-types";

export interface LifetimeTierHistoryPoint {
  transactionId: number | null;
  createdAt: string | null;
  type: "START" | "EARN" | "EARN_REVERSAL";
  total: string;
  orderId: number | null;
  reason: string;
}

export interface LifetimeTierHistory {
  points: LifetimeTierHistoryPoint[];
  isConsistent: boolean;
}

interface ExactDecimal {
  units: bigint;
  scale: number;
}

const decimalPattern = /^(-?)(\d{1,26})(?:\.(\d{1,12}))?$/;

function parseExactDecimal(value: string): ExactDecimal {
  const match = decimalPattern.exec(value);
  if (!match) throw new Error("Invalid exact point value");

  const sign = match[1] === "-" ? -1n : 1n;
  const fraction = match[3] ?? "";
  const units = BigInt(match[2] + fraction) * sign;
  return { units, scale: fraction.length };
}

function addExactDecimal(left: ExactDecimal, right: ExactDecimal): ExactDecimal {
  const scale = Math.max(left.scale, right.scale);
  const leftUnits = left.units * 10n ** BigInt(scale - left.scale);
  const rightUnits = right.units * 10n ** BigInt(scale - right.scale);
  return { units: leftUnits + rightUnits, scale };
}

function formatExactDecimal(value: ExactDecimal): string {
  const negative = value.units < 0n;
  const digits = (negative ? -value.units : value.units).toString().padStart(value.scale + 1, "0");
  const integer = value.scale ? digits.slice(0, -value.scale) : digits;
  const fraction = value.scale ? digits.slice(-value.scale).replace(/0+$/, "") : "";
  return (negative && value.units !== 0n ? "-" : "") + integer + (fraction ? "." + fraction : "");
}

function sameExactDecimal(left: ExactDecimal, right: ExactDecimal): boolean {
  const scale = Math.max(left.scale, right.scale);
  return (
    left.units * 10n ** BigInt(scale - left.scale) ===
    right.units * 10n ** BigInt(scale - right.scale)
  );
}

function isLifetimeEvent(
  transaction: WalletTransactionDto,
): transaction is WalletTransactionDto & { type: "EARN" | "EARN_REVERSAL" } {
  return transaction.type === "EARN" || transaction.type === "EARN_REVERSAL";
}

function compareTransactions(left: WalletTransactionDto, right: WalletTransactionDto): number {
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return left.createdAt.localeCompare(right.createdAt) || left.id - right.id;
}

export function buildLifetimeTierHistory(
  transactions: readonly WalletTransactionDto[],
  netLifetimeEarned: string,
): LifetimeTierHistory {
  const events = transactions.filter(isLifetimeEvent).slice().sort(compareTransactions);
  let running: ExactDecimal = { units: 0n, scale: 0 };
  const points: LifetimeTierHistoryPoint[] = [
    {
      transactionId: null,
      createdAt: null,
      type: "START",
      total: "0",
      orderId: null,
      reason: "Bắt đầu",
    },
  ];

  try {
    for (const event of events) {
      const delta = parseExactDecimal(event.delta);
      if ((event.type === "EARN" && delta.units < 0n) || (event.type === "EARN_REVERSAL" && delta.units > 0n)) {
        return { points: [], isConsistent: false };
      }
      running = addExactDecimal(running, delta);
      points.push({
        transactionId: event.id,
        createdAt: event.createdAt,
        type: event.type,
        total: formatExactDecimal(running),
        orderId: event.orderId,
        reason: event.reason,
      });
    }

    return {
      points,
      isConsistent: sameExactDecimal(running, parseExactDecimal(netLifetimeEarned)),
    };
  } catch {
    return { points: [], isConsistent: false };
  }
}
