"use client";

import { useRef, useState, type PointerEvent } from "react";

import { Button } from "@/src/components/ui/button";
import type { KycLocale } from "@/src/lib/kyc-questionnaire/types";
import { UI } from "@/src/lib/kyc-questionnaire/ui";

/** The signer draws on a fixed-size transparent PNG, which the server checks before filing. */
export function SignaturePad({ locale, onChange }: { locale: KycLocale; onChange: (image: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<number | null>(null);
  const ink = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const position = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * 600 / bounds.width, y: (event.clientY - bounds.top) * 180 / bounds.height };
  };
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (pointer.current !== null) return;
    event.preventDefault();
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    pointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = position(event);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#182033";
    context.beginPath();
    context.moveTo(x, y);
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (pointer.current !== event.pointerId) return;
    event.preventDefault();
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const { x, y } = position(event);
    context.lineTo(x, y);
    context.stroke();
    if (!ink.current) {
      ink.current = true;
      setHasInk(true);
    }
  };
  const end = (event: PointerEvent<HTMLCanvasElement>) => {
    if (pointer.current !== event.pointerId) return;
    event.preventDefault();
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onChange(ink.current ? event.currentTarget.toDataURL("image/png") : null);
  };
  const clear = () => {
    canvas.current?.getContext("2d")?.clearRect(0, 0, 600, 180);
    ink.current = false;
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="grid min-w-0 max-w-[600px] gap-2">
      <p className="text-sm font-medium">{UI.onlineDraw[locale]}</p>
      <canvas
        ref={canvas}
        width={600}
        height={180}
        role="img"
        aria-label={UI.onlineDraw[locale]}
        className="block h-auto w-full rounded-md border border-input bg-white touch-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div>
        <Button type="button" size="sm" variant="outline" disabled={!hasInk} onClick={clear}>{UI.onlineClear[locale]}</Button>
      </div>
    </div>
  );
}
