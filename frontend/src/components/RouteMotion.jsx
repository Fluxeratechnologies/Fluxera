import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/** Animate the new page without remounting the workspace or its SSE connection. */
export function RouteMotion() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (!main?.animate) return undefined;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animation = main.animate(
      preference.matches
        ? [{ opacity: .85 }, { opacity: 1 }]
        : [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: preference.matches ? 100 : 360, easing: "cubic-bezier(.22,1,.36,1)" },
    );
    const stop = () => animation.cancel();
    preference.addEventListener("change", stop);
    return () => { animation.cancel(); preference.removeEventListener("change", stop); };
  }, [pathname]);
  return null;
}
