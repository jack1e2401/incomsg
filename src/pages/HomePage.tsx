import { StatusCard } from "../features/health/components/StatusCard";

export function HomePage() {
  return (
    <main className="page">
      <div className="content">
        <p className="eyebrow">IncomSG</p>
        <h1>Frontend đã sẵn sàng</h1>
        <p className="intro">React + TypeScript, chia theo feature. Bắt đầu xây trang và component của bạn tại <code>src/pages</code> và <code>src/features</code>.</p>
        <StatusCard />
      </div>
    </main>
  );
}
