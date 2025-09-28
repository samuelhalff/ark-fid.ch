"use client";
import React from "react";

export default function Defer({
  children,
  rootMargin = "200px",
  idle = 100,
  placeholder,
}: {
  children: React.ReactNode;
  rootMargin?: string;
  idle?: number;
  placeholder?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current || visible) return;
    let cancelled = false;
    const el = ref.current;
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              const trigger = () => !cancelled && setVisible(true);
              if ("requestIdleCallback" in window) {
                (
                  window as Window & {
                    requestIdleCallback: (
                      cb: () => void,
                      options: { timeout: number }
                    ) => void;
                  }
                ).requestIdleCallback(trigger, { timeout: idle });
              } else {
                setTimeout(trigger, idle);
              }
              io.disconnect();
            }
          });
        },
        { rootMargin }
      );
      io.observe(el);
      return () => {
        cancelled = true;
        io.disconnect();
      };
    } else {
      // Fallback: render after idle timeout when IO is not supported
      const t = setTimeout(() => !cancelled && setVisible(true), idle);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
  }, [rootMargin, idle, visible]);

  return <div ref={ref}>{visible ? children : placeholder || null}</div>;
}
