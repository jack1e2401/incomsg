import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

const height = 224;
const compactNumber = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });

export default function MerchantRevenuePlot({ days }: { days: { label: string; amount: number }[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = container.current;
    if (!target) return;

    const indexes = days.map((_, index) => index);
    const amounts = days.map((day) => day.amount);
    const min = Math.min(0, ...amounts);
    const max = Math.max(0, ...amounts);
    const plot = new uPlot(
      {
        width: Math.max(1, target.clientWidth),
        height,
        legend: { show: false },
        cursor: { show: false },
        scales: {
          x: { time: false, range: [-0.5, days.length - 0.5] },
          y: { range: [min * 1.15, max === 0 && min === 0 ? 1 : max * 1.15] },
        },
        series: [{}, { fill: "#46754d", paths: uPlot.paths.bars?.({ size: [0.55, 48], radius: [0.14, 0] }) }],
        axes: [
          {
            splits: () => {
              const step = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor((target.clientWidth - 54) / 44))));
              return indexes.filter((index) => (days.length - 1 - index) % step === 0);
            },
            values: (_, ticks) => ticks.map((index) => days[index]?.label ?? ""),
            size: 28,
            font: "11px 'Plus Jakarta Sans', sans-serif",
            stroke: "#53685a",
            grid: { show: false },
            ticks: { show: false },
          },
          {
            values: (_, ticks) => ticks.map((amount) => compactNumber.format(amount)),
            size: 54,
            font: "11px 'Plus Jakarta Sans', sans-serif",
            stroke: "#53685a",
            grid: { stroke: "#e4ebe1" },
            ticks: { show: false },
          },
        ],
      },
      [indexes, amounts],
      target,
    );
    const observer = new ResizeObserver(() => {
      const width = target.clientWidth;
      if (width > 0 && width !== plot.width) plot.setSize({ width, height });
    });
    observer.observe(target);
    return () => {
      observer.disconnect();
      plot.destroy();
    };
  }, [days]);

  return <div ref={container} aria-hidden="true" className="min-h-56 min-w-0" />;
}
