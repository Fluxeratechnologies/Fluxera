import React from "react";

export function Dot({ active = false, color = "#D9541E" }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{
        backgroundColor: color,
        boxShadow: "none",
        animation: active ? "signal 1.6s ease infinite" : "none",
      }}
    />
  );
}

export function Pill({ children, color = "#5b554c", bg = "#F3EEE3", border = "rgba(17,17,17,.16)" }) {
  return (
    <span
      className="inline-flex items-center text-[10px] font-mono font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full shadow-sm"
      style={{
        color,
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      {children}
    </span>
  );
}

export function BarLine({ value, max, color = "#D9541E" }) {
  const w = Math.min((value / (max || 1)) * 100, 100);
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden mt-1.5 border border-white/10 bg-white/10">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${w}%`,
          background: color.startsWith("#") || color.startsWith("rgb") || color.startsWith("var")
            ? color
            : `linear-gradient(90deg, #D9541E, #111111)`,
        }}
      />
    </div>
  );
}
