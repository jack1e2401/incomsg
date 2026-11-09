import { useEffect, useState } from "react";
import { getHealth } from "../api/getHealth";

type Status = "checking" | "online" | "offline";

export function StatusCard() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(() => setStatus("online"))
      .catch(() => {
        if (!controller.signal.aborted) setStatus("offline");
      });
    return () => controller.abort();
  }, []);

  const label = {
    checking: "Đang kiểm tra API…",
    online: "API đang hoạt động",
    offline: "Chưa kết nối được API",
  }[status];

  return (
    <section className="status-card" aria-live="polite">
      <span className={`status-dot status-dot--${status}`} aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <p>
          Backend: <code>GET /api/health</code>
        </p>
      </div>
    </section>
  );
}
