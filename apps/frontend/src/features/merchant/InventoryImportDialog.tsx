import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { readSheet } from "read-excel-file/browser";
import { createCommerceClient } from "../../api/commerce-http";
import type { ProductDto } from "../../api/commerce-types";
import { parseInventoryImportRows, type InventoryImportRow } from "./inventory-import";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const maxFileSize = 10 * 1024 * 1024;

type Props = {
  open: boolean;
  onOpenChange(open: boolean): void;
  products: ProductDto[];
  token: string;
  onImported(): void;
};

async function fingerprint(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (const byte of new Uint8Array(bytes)) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16);
}

export function InventoryImportDialog({ open, onOpenChange, products, token, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<InventoryImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loadingFile, setLoadingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function reset() {
    setFile(null);
    setRows([]);
    setErrors([]);
    setLoadingFile(false);
    setImporting(false);
    setNotice("");
    setError("");
  }

  async function readFile(selected: File | undefined) {
    reset();
    if (!selected) return;
    setFile(selected);
    if (!selected.name.toLowerCase().endsWith(".xlsx")) {
      setErrors(["Chỉ hỗ trợ file Excel .xlsx."]);
      return;
    }
    if (selected.size > maxFileSize) {
      setErrors(["File phải nhỏ hơn 10 MB."]);
      return;
    }
    setLoadingFile(true);
    try {
      const sheet = await readSheet(selected);
      const parsed = parseInventoryImportRows(sheet, products);
      setRows(parsed.rows);
      setErrors(parsed.errors);
    } catch {
      setErrors(["Không đọc được file Excel. Kiểm tra định dạng và thử lại."]);
    } finally {
      setLoadingFile(false);
    }
  }

  async function importRows() {
    if (!file || rows.length === 0 || errors.length || importing) return;
    setImporting(true);
    setError("");
    setNotice("");
    let applied = 0;
    try {
      const fileHash = await fingerprint(file);
      const productById = new Map(products.map((product) => [product.id, product]));
      for (const row of rows) {
        const product = productById.get(row.productId);
        if (!product) throw new Error(`Không tìm thấy sản phẩm #${row.productId}.`);
        const reason = `Nhập Excel ${file.name.slice(0, 120)} · dòng ${row.rowNumber}`.slice(0, 255);
        const requestKey = `excel-${fileHash}-${row.productId}-${row.rowNumber}`.slice(0, 128);
        const body = { quantity: row.quantity, reason };
        if (product.kind === "REWARD") {
          await api.adjustRewardInventory(product.id, "in", body, token, requestKey);
        } else {
          await api.adjustProductInventory(product.id, "in", body, token, requestKey);
        }
        applied += 1;
      }
      onImported();
      setNotice(`Đã nhập kho ${applied} sản phẩm.`);
    } catch (failure) {
      onImported();
      const detail = failure instanceof Error ? failure.message : "lỗi không xác định";
      setError(applied > 0 ? `Đã nhập ${applied} dòng trước khi gặp lỗi: ${detail}` : `Không thể nhập kho: ${detail}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !importing) reset(); onOpenChange(nextOpen); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl p-6 shadow-2xl outline-none sm:p-7">
          <Dialog.Title className="text-xl font-extrabold text-[#20392a]">Nhập tồn kho từ Excel</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm muted">File .xlsx cần có cột “Mã sản phẩm” và “Số lượng nhập”. Mỗi mã sản phẩm xuất hiện một lần.</Dialog.Description>
          <label className="mt-5 grid cursor-pointer place-items-center rounded-2xl border border-dashed border-[#b8c9b7] bg-[#f7f9f5] px-4 py-6 text-center hover:bg-[#edf4e9]">
            <span className="font-bold">{file?.name ?? "Chọn file Excel (.xlsx)"}</span>
            <span className="mt-1 text-xs muted">Tối đa 10 MB</span>
            <input aria-label="Chọn file Excel" className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void readFile(event.target.files?.[0])} />
          </label>
          {loadingFile && <p className="mt-4 text-sm muted">Đang đọc file…</p>}
          {errors.length > 0 && <ul role="alert" className="mt-4 list-disc space-y-1 rounded-xl bg-[#fae7e3] p-4 pl-8 text-sm text-[#a4473a]">{errors.map((item) => <li key={item}>{item}</li>)}</ul>}
          {rows.length > 0 && errors.length === 0 && (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-[#e4e9e1]">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-[#f7f9f5] text-xs uppercase tracking-wide muted"><tr><th className="px-4 py-3">Sản phẩm</th><th className="px-4 py-3">Mã</th><th className="px-4 py-3 text-right">Số lượng nhập</th></tr></thead>
                <tbody className="divide-y divide-[#edf1ea]">{rows.map((row) => <tr key={row.productId}><td className="px-4 py-3 font-semibold">{row.productName}</td><td className="px-4 py-3">#{row.productId}</td><td className="px-4 py-3 text-right font-bold">+{row.quantity}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {error && <p role="alert" className="mt-4 text-sm text-[#a4473a]">{error}</p>}
          {notice && <p role="status" className="mt-4 text-sm text-[#357044]">{notice}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" disabled={importing} onClick={() => { reset(); onOpenChange(false); }} className="rounded-full px-4 py-2 text-sm font-bold text-[#516357] hover:bg-[#edf3e9]">{notice ? "Đóng" : "Hủy"}</button>
            <button type="button" disabled={importing || loadingFile || rows.length === 0 || errors.length > 0 || Boolean(notice)} onClick={() => void importRows()} className="rounded-full bg-[#335e3d] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{importing ? "Đang nhập…" : notice ? "Đã nhập" : `Nhập ${rows.length} sản phẩm`}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
