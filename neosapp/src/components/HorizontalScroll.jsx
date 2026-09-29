import { useLayoutEffect, useRef, useState } from "react";
import "../styles/horizontal-scroll.css";

export default function HorizontalScroll({ children, className = "", viewportClassName = "" }) {
  const viewportRef = useRef(null);
  const topScrollbarRef = useRef(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const measure = () => {
      const width = viewport.scrollWidth;
      setContentWidth((current) => current === width ? current : width);
      setHasOverflow((current) => current === (width > viewport.clientWidth + 1)
        ? current
        : width > viewport.clientWidth + 1);
    };

    measure();
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resizeObserver?.observe(viewport);
    Array.from(viewport.children).forEach((child) => resizeObserver?.observe(child));

    const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(measure);
    mutationObserver?.observe(viewport, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useLayoutEffect(() => {
    if (topScrollbarRef.current && viewportRef.current) {
      topScrollbarRef.current.scrollLeft = viewportRef.current.scrollLeft;
    }
  }, [hasOverflow]);

  const sincronizarScrollSuperior = () => {
    if (topScrollbarRef.current && viewportRef.current) {
      viewportRef.current.scrollLeft = topScrollbarRef.current.scrollLeft;
    }
  };

  const sincronizarScrollInferior = () => {
    if (topScrollbarRef.current && viewportRef.current) {
      topScrollbarRef.current.scrollLeft = viewportRef.current.scrollLeft;
    }
  };

  return (
    <div className={["horizontal-scroll", className].filter(Boolean).join(" ")}>
      {hasOverflow && (
        <div
          ref={topScrollbarRef}
          className="horizontal-scroll__top"
          role="region"
          aria-label="Desplazar tabla horizontalmente"
          tabIndex={0}
          onScroll={sincronizarScrollSuperior}
        >
          <div className="horizontal-scroll__spacer" style={{ width: `${contentWidth}px` }} />
        </div>
      )}
      <div
        ref={viewportRef}
        className={["horizontal-scroll__viewport", viewportClassName].filter(Boolean).join(" ")}
        onScroll={sincronizarScrollInferior}
      >
        {children}
      </div>
    </div>
  );
}