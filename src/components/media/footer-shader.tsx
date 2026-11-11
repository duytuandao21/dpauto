"use client";

import Image from "next/image";
import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export function FooterShader({
  kind,
  logoSrc,
  palette,
}: {
  kind: "logo" | "background";
  logoSrc?: string;
  palette?: "red";
}) {
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const near = useInView(root, { margin: "300px", once: true });
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!near || reduced || !canvas.current) return;
    const controller = new AbortController();
    let frame = 0;
    let renderer: { draw: (time: number) => void; dispose: () => void } | null =
      null;
    let visible = false,
      last = 0;
    const tick = (time: number) => {
      if (controller.signal.aborted) return;
      if (
        visible &&
        document.visibilityState === "visible" &&
        time - last >= 32
      ) {
        renderer?.draw(time / 1000);
        last = time;
      }
      frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    if (root.current) observer.observe(root.current);
    import("@/lib/shader-renderer")
      .then(async ({ createShaderRenderer }) => {
        const next = await createShaderRenderer(
          canvas.current!,
          kind,
          controller.signal,
          { logoSrc, palette },
        );
        if (controller.signal.aborted) {
          next?.dispose();
          return;
        }
        renderer = next;
        if (renderer) {
          renderer.draw(0);
          setReady(true);
          frame = requestAnimationFrame(tick);
        }
      })
      .catch(() => {
        /* The original exported image remains visible without WebGL. */
      });
    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer?.dispose();
    };
  }, [near, reduced, kind, logoSrc, palette]);
  return (
    <div
      ref={root}
      className={`footer-shader footer-shader--${kind}`}
      aria-hidden="true"
      data-renderer={ready ? "webgl" : "image"}
    >
      <Image
        src={
          kind === "logo" && logoSrc ? logoSrc : `/effects/footer-${kind}.png`
        }
        alt=""
        fill
        sizes="100vw"
        className={ready ? "shader-fallback is-hidden" : "shader-fallback"}
      />
      <canvas ref={canvas} className={ready ? "is-ready" : ""} />
    </div>
  );
}
