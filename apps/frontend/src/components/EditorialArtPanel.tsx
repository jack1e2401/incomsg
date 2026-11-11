export function EditorialArtPanel({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative isolate aspect-[.94] w-full overflow-hidden rounded-[2rem] bg-[#284632] ${className}`}
    >
      <img
        src="/images/ceramics-market.jpg"
        alt="Gốm thủ công trong một cửa hàng độc lập"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#163623]/65 via-transparent to-[#163623]/10" />
      <div className="absolute -bottom-[8%] -right-[9%] h-[50%] w-[48%] overflow-hidden rounded-[1.6rem] border-[7px] border-[#f7f8f4] shadow-2xl sm:rounded-[2rem] sm:border-[9px]">
        <img src="/images/independent-cafe.jpg" alt="" className="h-full w-full object-cover object-center" />
      </div>
      <div className="absolute bottom-6 left-6 h-14 w-14 rounded-full border border-white/60 sm:bottom-8 sm:left-8 sm:h-20 sm:w-20" />
    </div>
  );
}
