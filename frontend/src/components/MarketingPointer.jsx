import { useEffect, useState } from "react";
import { Pointer } from "./ui/pointer";

const ENABLED = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

export function MarketingPointer() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(ENABLED);
    const update = () => setEnabled(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return enabled ? <Pointer aria-hidden="true" /> : null;
}
