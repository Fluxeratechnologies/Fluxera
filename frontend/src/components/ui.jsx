import React from "react";

export function Dot({ active = false, color = "#e11d48" }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{
        backgroundColor: color,
        boxShadow: active ? `0 0 8px ${color}` : "none",
        animation: active ? "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" : "none",
      }}
    />
  );
}

export function Pill({ children, color = "#fda4af", bg = "rgba(244, 63, 94, 0.14)", border = "rgba(251, 113, 133, 0.32)" }) {
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

export function BarLine({ value, max, color = "#e11d48" }) {
  const w = Math.min((value / (max || 1)) * 100, 100);
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden mt-1.5 border border-white/10 bg-white/10">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${w}%`,
          background: color.startsWith("#") || color.startsWith("rgb") || color.startsWith("var")
            ? color
            : `linear-gradient(90deg, #fb7185, #e11d48)`,
        }}
      />
    </div>
  );
}
