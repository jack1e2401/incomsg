import { useEffect, useState } from "react";
import type { ProductDto } from "../../api/commerce-types";

type CartLine = { product: ProductDto; quantity: number };
const maxQuantity = 99;
const maxLines = 100;

function isCartLine(value: unknown, merchantId: number): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const { product, quantity } = value as Partial<CartLine>;
  return (
    !!product &&
    product.merchantId === merchantId &&
    Number.isSafeInteger(product.id) &&
    product.id > 0 &&
    typeof product.name === "string" &&
    typeof product.price === "string" &&
    /^[1-9]\d{0,14}$/.test(product.price) &&
    typeof quantity === "number" &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= maxQuantity
  );
}

function readCart(storageKey: string, merchantId: number): CartLine[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    // Previous versions stored a single line in this key.
    const lines: unknown[] = Array.isArray(saved) ? saved : [saved];
    const byId = new Map<number, CartLine>();
    for (const line of lines) {
      if (isCartLine(line, merchantId)) byId.set(line.product.id, line);
      if (byId.size === maxLines) break;
    }
    return [...byId.values()];
  } catch {
    return [];
  }
}

function canAddLine(lines: CartLine[], productId: number): boolean {
  const line = lines.find(({ product }) => product.id === productId);
  const available = line?.product.inventory?.availableQuantity ?? maxQuantity;
  return available > 0 && (line ? line.quantity < Math.min(maxQuantity, available) : lines.length < maxLines);
}

export function useMemberCart(storageKey: string, merchantId: number) {
  const [lines, setLines] = useState(() => readCart(storageKey, merchantId));

  useEffect(() => {
    try {
      if (lines.length) sessionStorage.setItem(storageKey, JSON.stringify(lines));
      else sessionStorage.removeItem(storageKey);
    } catch {
      // The current cart is still usable without browser storage.
    }
  }, [lines, storageKey]);

  return {
    lines,
    quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce(
      (sum, { product, quantity }) => sum + BigInt(product.price) * BigInt(quantity),
      0n,
    ),
    canAdd: (productId: number, availableQuantity?: number) => {
      const line = lines.find(({ product }) => product.id === productId);
      const available = availableQuantity ?? line?.product.inventory?.availableQuantity ?? maxQuantity;
      return available > 0 && (line ? line.quantity < Math.min(maxQuantity, available) : lines.length < maxLines);
    },
    addProduct(product: ProductDto) {
      setLines((previous) => {
        if (product.merchantId !== merchantId || !canAddLine(previous, product.id) ||
            (product.inventory && (previous.find((line) => line.product.id === product.id)?.quantity ?? 0) >= product.inventory.availableQuantity)) return previous;
        if (previous.some((line) => line.product.id === product.id)) {
          return previous.map((line) =>
            line.product.id === product.id ? { product, quantity: line.quantity + 1 } : line,
          );
        }
        return [...previous, { product, quantity: 1 }];
      });
    },
    setQuantity(productId: number, quantity: number) {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity) return;
      setLines((previous) =>
        previous.map((line) => {
          if (line.product.id !== productId) return line;
          const available = line.product.inventory?.availableQuantity ?? maxQuantity;
          return quantity <= available ? { ...line, quantity } : line;
        }),
      );
    },
    removeProduct(productId: number) {
      setLines((previous) => previous.filter((line) => line.product.id !== productId));
    },
    clear() {
      setLines([]);
    },
  };
}
