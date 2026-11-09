export function LoyaltyIllustration({ className = "" }: { className?: string }) {
  return (
    <div className={`grid h-full w-full place-items-center ${className}`} aria-hidden="true">
      <div className="relative grid aspect-square w-3/4 max-w-60 place-items-center rounded-[40%] bg-[#cfe7b6] shadow-[0_18px_32px_rgba(69,102,60,.12)]">
        <span className="text-4xl font-extrabold tracking-tight text-[#3b6844]">L</span>
        <span className="absolute -right-3 top-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#f2d39e] text-xl text-[#805b3b]">
          ✧
        </span>
        <span className="absolute -bottom-3 left-5 h-7 w-7 rounded-full bg-[#e3b7a1]" />
      </div>
    </div>
  );
}
