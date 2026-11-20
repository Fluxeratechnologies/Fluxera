import React from "react";

/** Fluxera's checkpoint mark: one durable path with an explicit approval node. */
export function FluxeraMark({ inverse = false, size = 28, title = "Fluxera" }) {
  const tile = inverse ? "#F3EEE3" : "#E7DFD1";
  const glyph = inverse ? "#111111" : "#111111";

  return (
    <svg
      aria-label={title}
      className="fluxera-mark"
      height={size}
      role="img"
      viewBox="0 0 36 36"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect fill={tile} height="34" rx="7" width="34" x="1" y="1" />
      <path d="M8 7h19v6H14v5h9v6h-9v5H8Z" fill={glyph} />
      <rect fill="#D9541E" height="6" width="6" x="23" y="18" />
    </svg>
  );
}
