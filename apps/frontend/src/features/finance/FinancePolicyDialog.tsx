import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "../../components/ui";

const pages = [
  {
    title: "Hai sổ giao dịch",
    paragraphs: [
      "Sổ điểm ghi nhận giao dịch giữa Thành viên và cửa hàng. Đơn thanh toán cộng điểm, đổi thưởng trừ điểm, hoàn đơn thu hồi điểm và hủy đổi thưởng hoàn lại điểm.",
      "Sổ phí ghi nhận giao dịch giữa cửa hàng và nền tảng bằng VND. Mỗi lần tính hoặc hoàn phí có một dòng riêng liên kết với đơn gốc. Phí thực tế là tổng các dòng có dấu trong kỳ. Bản demo chỉ ghi nhận phí.",
    ],
    example:
      "Một đơn có thể tạo đồng thời +20 điểm trong sổ điểm và +10.000 ₫ trong sổ phí. Hai giá trị được đọc riêng.",
    source: {
      label: "Stripe · Balance Transactions",
      href: "https://docs.stripe.com/api/balance_transactions",
    },
  },
  {
    title: "Hạng cửa hàng theo năm",
    paragraphs: [
      "Doanh thu xét hạng là giá trị thực trả của các đơn đã thanh toán từ 1/1 theo giờ Việt Nam. Bronze dưới 10 triệu đồng, Silver từ 10 triệu đồng và Gold từ 50 triệu đồng.",
      "Hạng được xét lại khi thanh toán hoặc hoàn tiền hoàn tất. Sang 1/1, cửa hàng bắt đầu kỳ mới ở Bronze. Lịch sử phí vẫn có thể tra theo ngày. Hạng thành viên tiếp tục tính theo quy tắc điểm của từng cửa hàng.",
    ],
    example: "Cửa hàng đạt 10 triệu đồng sau một đơn Bronze. Đơn tiếp theo áp dụng phí Silver.",
    source: {
      label: "Sephora · Điều khoản Beauty Insider",
      href: "https://www.sephora.com/beauty/terms-conditions-beauty-insider",
    },
  },
  {
    title: "Tính phí tại lúc thanh toán",
    paragraphs: [
      "Phí bán hàng bằng tiền sau giảm giá nhân tỷ lệ của hạng đang áp dụng: Bronze 5%, Silver 4%, Gold 3%. Kết quả được làm tròn đến đồng gần nhất, phần lẻ đúng 0,5 đồng được làm tròn lên.",
      "Dòng phí lưu số tiền tính phí, hạng và tỷ lệ áp dụng tại thời điểm đơn thanh toán thành công. Có thể tra lại mức phí của đơn kể cả khi cửa hàng đã đổi hạng.",
    ],
    example: "Một đơn 200.000 ₫ ở hạng Silver ghi phí 8.000 ₫. Đơn làm phí tròn về 0 ₫ vẫn có dòng lịch sử.",
  },
  {
    title: "Hoàn phí và đối chiếu theo kỳ",
    paragraphs: [
      "Khi hoàn tiền toàn phần hoàn tất, hệ thống ghi dòng âm bằng đúng phí gốc. Yêu cầu VNPay đang chờ xác nhận chưa được tính là hoàn phí.",
      "Bảng phí phân kỳ theo ngày phát sinh của từng dòng. Dùng mã đơn để tìm cả phí gốc lẫn hoàn phí qua các kỳ. Doanh thu xét hạng của năm mới chỉ dựa trên các đơn của năm đó.",
    ],
    example: "Đơn tháng 12 ghi +8.000 ₫, hoàn vào tháng 1 ghi −8.000 ₫. Phí thực tế tháng 1 có thể âm.",
    source: { label: "Stripe · Báo cáo theo kỳ", href: "https://docs.stripe.com/reports/balance" },
  },
  {
    title: "Đề xuất sau demo",
    paragraphs: [
      "Có thể cân nhắc giữ hạng đã đạt đến hết năm sau để giảm chênh lệch phí đầu năm. Khi thay đổi ngưỡng hoặc tỷ lệ, nên ghi thời điểm hiệu lực để cửa hàng biết mức phí của đơn kế tiếp.",
      "Nếu hỗ trợ hoàn một phần, cần chốt cách chia phí, làm tròn từng lần và giới hạn tổng hoàn theo phí gốc. Đối soát, thu phí và chuyển tiền cần thiết kế riêng trước khi vận hành thật.",
    ],
    example:
      "Một đơn 200.000 ₫ đã ghi 8.000 ₫ phí. Khi hoàn 50.000 ₫, chính sách tương lai có thể hoàn 2.000 ₫ theo tỷ lệ gốc.",
    source: {
      label: "Stripe · Các loại giao dịch",
      href: "https://docs.stripe.com/reports/balance-transaction-types",
    },
  },
] as const;

export function FinancePolicyDialog() {
  const [page, setPage] = useState(0);
  const current = pages[page];

  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (open) setPage(0);
      }}
    >
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" size="sm">
          Đề xuất nghiệp vụ
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl p-6 shadow-2xl outline-none sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Dialog.Title className="text-xl font-extrabold">Đề xuất nghiệp vụ</Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="sm">
                Đóng
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Quy tắc hạng cửa hàng, phí bán hàng và hướng mở rộng.
          </Dialog.Description>
          <section className="mt-5 space-y-3" aria-live="polite">
            <h3 className="font-extrabold text-[#20392a]">{current.title}</h3>
            {current.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-6 muted">
                {paragraph}
              </p>
            ))}
            <p className="rounded-xl bg-[#edf4e9] p-3 text-sm leading-6 text-[#294833]">{current.example}</p>
            {"source" in current && (
              <a
                href={current.source.href}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm font-semibold underline"
              >
                {current.source.label}
              </a>
            )}
          </section>
          <footer className="mt-6 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              Trước
            </Button>
            <span className="text-sm font-semibold muted" aria-live="polite">
              {page + 1}/{pages.length}
            </span>
            <Button
              type="button"
              size="sm"
              disabled={page === pages.length - 1}
              onClick={() => setPage((value) => value + 1)}
            >
              Tiếp
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
