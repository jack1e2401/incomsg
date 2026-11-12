import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { createCommerceClient } from "../../api/commerce-http";
import { useResource } from "../../api/useResource";
import { Button, EmptyState, ErrorState, Field, Input, LoadingState } from "../../components/ui";
import {
  formatPointDelta,
  LoyaltyWalletContent,
  pointTransactionLabel,
} from "../member/LoyaltyWalletContent";
import { MemberLoyaltyPolicyDialog } from "../member/MemberLoyaltyPolicyDialog";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const membersPath = "/merchant/loyalty?tab=members";

export function MerchantLoyaltyMembers({ token, memberId }: { token: string; memberId: string | null }) {
  const [draftEmail, setDraftEmail] = useState("");
  const [email, setEmail] = useState("");
  const [cursors, setCursors] = useState<(number | null)[]>([null]);
  const cursor = cursors.at(-1) ?? null;
  const resource = useResource(
    () => api.listMerchantLoyaltyMembers({ email, cursor }, token),
    [email, cursor, token],
  );

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmail(draftEmail.trim());
    setCursors([null]);
  }

  if (memberId !== null) return <MerchantMemberWallet token={token} memberId={memberId} />;

  const items = resource.data?.items ?? [];
  const nextCursor = resource.data?.nextCursor ?? null;
  return (
    <section aria-label="Thành viên Loyalty" className="space-y-4">
      <form className="flex flex-wrap items-end gap-2" onSubmit={search}>
        <Field label="Email thành viên">
          <Input
            type="search"
            value={draftEmail}
            maxLength={191}
            onChange={(event) => setDraftEmail(event.target.value)}
          />
        </Field>
        <Button type="submit" variant="outline">
          Tìm
        </Button>
      </form>
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title={email ? "Không tìm thấy thành viên" : "Chưa có thành viên"}
          description={email ? "Thử tìm bằng một phần email." : "Khách sẽ xuất hiện sau khi mua hàng và tích điểm tại cửa hàng."}
        />
      ) : (
        <div className="surface overflow-x-auto rounded-3xl">
          <table
            aria-label="Điểm Loyalty theo thành viên"
            className="w-full min-w-[780px] border-collapse text-left"
          >
            <thead className="bg-[#f7f9f5] text-xs font-bold uppercase tracking-wide text-[#65746a]">
              <tr>
                <th scope="col" className="px-5 py-4">
                  Thành viên
                </th>
                <th scope="col" className="px-4 py-4">
                  Hạng
                </th>
                <th scope="col" className="px-4 py-4">
                  Điểm khả dụng
                </th>
                <th scope="col" className="px-4 py-4">
                  Tổng tích lũy
                </th>
                <th scope="col" className="px-4 py-4">
                  Biến động gần nhất
                </th>
                <th scope="col" className="px-4 py-4">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((member) => (
                <tr key={member.id} className="border-t border-[#edf1ea] align-middle text-sm">
                  <th scope="row" className="max-w-64 break-all px-5 py-4 font-bold text-[#20392a]">
                    {member.email}
                    <span className="mt-1 block text-xs font-normal muted">#{member.id}</span>
                  </th>
                  <td className="px-4 py-4">{member.tier === "UNRANKED" ? "Chưa xếp hạng" : member.tier}</td>
                  <td className="px-4 py-4 tabular-nums">
                    <b>{member.availablePoints.toLocaleString("vi-VN")}</b>
                    {member.pointDebt !== "0" && (
                      <p className="mt-1 text-xs text-[#a4473a]">Nợ {member.pointDebt}</p>
                    )}
                  </td>
                  <td className="px-4 py-4 tabular-nums">{member.netLifetimeEarned}</td>
                  <td className="px-4 py-4">
                    {member.latestChange ? (
                      <>
                        <b
                          className={`mr-2 tabular-nums ${member.latestChange.delta.startsWith("-") ? "text-[#a4473a]" : "text-[#357044]"}`}
                        >
                          {formatPointDelta(member.latestChange.delta)}
                        </b>
                        {pointTransactionLabel(member.latestChange.type)}
                        <time className="mt-1 block text-xs muted" dateTime={member.latestChange.createdAt}>
                          {new Date(member.latestChange.createdAt).toLocaleString("vi-VN")}
                        </time>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Button asChild variant="outline" size="sm" className="whitespace-nowrap">
                      <Link
                        to={`${membersPath}&memberId=${member.id}`}
                        aria-label={`Chi tiết ${member.email}`}
                      >
                        Chi tiết <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!resource.loading && !resource.error && (cursors.length > 1 || nextCursor !== null) && (
        <nav aria-label="Trang thành viên" className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={cursors.length === 1}
            onClick={() => setCursors((previous) => previous.slice(0, -1))}
          >
            Trang trước
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={nextCursor === null}
            onClick={() => setCursors((previous) => [...previous, nextCursor])}
          >
            Trang sau
          </Button>
        </nav>
      )}
    </section>
  );
}

function MerchantMemberWallet({ token, memberId }: { token: string; memberId: string }) {
  const resource = useResource(() => api.getMerchantLoyaltyMemberWallet(memberId, token), [memberId, token]);
  const detail = resource.data;
  return (
    <section aria-label="Chi tiết ví điểm thành viên">
      <Button asChild variant="outline" size="sm" className="mb-4">
        <Link to={membersPath}>
          <ArrowLeft size={16} aria-hidden="true" /> Danh sách thành viên
        </Link>
      </Button>
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : (
        detail && (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-all text-xl font-extrabold text-[#20392a]">{detail.member.email}</h2>
                <p className="mt-1 text-xs muted">Thành viên #{detail.member.id}</p>
              </div>
              {detail.wallet.policy && <MemberLoyaltyPolicyDialog policy={detail.wallet.policy} />}
            </div>
            <LoyaltyWalletContent wallet={detail.wallet} />
          </>
        )
      )}
    </section>
  );
}
