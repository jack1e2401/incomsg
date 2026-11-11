import { lazy, Suspense, useState } from "react";

const RiveCanvas = lazy(() => import("./RiveCanvas"));

/** Optional local Rive asset. Without a configured file, the member flow stays fully usable. */
export function MemberMascot({
  mood = "idle",
  className = "",
}: {
  mood?: "idle" | "hello" | "success";
  className?: string;
}) {
  const src = import.meta.env.VITE_MEMBER_RIVE_SRC;
  const [failed, setFailed] = useState(false);
  const reduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const face = mood === "success" ? "✦‿✦" : mood === "hello" ? "◕‿◕" : "•‿•";
  const fallback = (
    <div className={`grid h-full w-full place-items-center ${className}`} aria-hidden="true">
      <div
        className={`relative grid aspect-square w-3/4 max-w-60 place-items-center rounded-[40%] bg-[#cfe7b6] shadow-[0_18px_32px_rgba(69,102,60,.12)] ${reduced ? "" : "transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-2"}`}
      >
        <span className="text-4xl font-extrabold tracking-tight text-[#3b6844]">{face}</span>
        <span className="absolute -right-3 top-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#f2d39e] text-xl">
          ✧
        </span>
        <span className="absolute -bottom-3 left-5 h-7 w-7 rounded-full bg-[#e3b7a1]" />
      </div>
    </div>
  );
  if (!src || failed || reduced) return fallback;
  return (
    <div className={`h-full w-full ${className}`} aria-hidden="true">
      <Suspense fallback={fallback}>
        <RiveCanvas src={src} onError={() => setFailed(true)} />
      </Suspense>
    </div>
  );
}
