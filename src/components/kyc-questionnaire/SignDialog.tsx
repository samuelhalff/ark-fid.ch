"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Label } from "@/src/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/src/components/ui/toggle-group";
import { imageToSignature, renderAutoSignature, type ImageRefusal } from "@/src/lib/kyc-questionnaire/signature-image";
import type { KycLocale } from "@/src/lib/kyc-questionnaire/types";
import { UI } from "@/src/lib/kyc-questionnaire/ui";

import { SignaturePad } from "./SignaturePad";

export type SignMethod = "auto" | "drawn" | "image";

const REFUSALS: Record<ImageRefusal, keyof typeof UI> = { type: "signImageType", size: "signImageSize", unreadable: "signImageUnreadable" };

/**
 * « Signer »: the signatory's name in handwriting (default), a drawing, or an image; all become one PNG.
 * `presentBy` is set on the firm's screen: the dialog is titled with the signatory and names who is present.
 */
export function SignDialog({
  open,
  onOpenChange,
  locale,
  signerName,
  presentBy,
  busy,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: KycLocale;
  signerName: string;
  presentBy?: string | null;
  busy: boolean;
  error: string;
  onSubmit: (method: SignMethod, image: string) => void;
}) {
  const [method, setMethod] = useState<SignMethod>("auto");
  const [auto, setAuto] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMethod("auto");
    setDrawn(null);
    setUploaded(null);
    setImageError("");
    setAccepted(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void renderAutoSignature(signerName).then((image) => live && setAuto(image));
    return () => {
      live = false;
    };
  }, [open, signerName]);

  const image = method === "auto" ? auto : method === "drawn" ? drawn : uploaded;
  const L = (key: keyof typeof UI) => UI[key][locale];

  const pick = async (list: FileList | null) => {
    const chosen = list?.[0];
    if (file.current) file.current.value = "";
    if (!chosen) return;
    const result = await imageToSignature(chosen);
    if ("refused" in result) {
      setImageError(L(REFUSALS[result.refused]));
      return;
    }
    setImageError("");
    setUploaded(result.image);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent className="max-h-dvh overflow-y-auto max-sm:left-0 max-sm:top-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:max-w-[560px]">
        <DialogHeader className="pr-8">
          <DialogTitle>{presentBy ? UI.signDialogTitleFor[locale].replace("{name}", signerName) : L("signDialogTitle")}</DialogTitle>
          <DialogDescription>{presentBy ? L("signDialogOnFirmScreen") : signerName}</DialogDescription>
        </DialogHeader>
        <ToggleGroup
          type="single"
          value={method}
          onValueChange={(v) => v && setMethod(v as SignMethod)}
          variant="outline"
          className="grid grid-cols-3 gap-1"
          aria-label={L("signDialogTitle")}
        >
          <ToggleGroupItem value="auto">{L("signTabAuto")}</ToggleGroupItem>
          <ToggleGroupItem value="drawn">{L("signTabDraw")}</ToggleGroupItem>
          <ToggleGroupItem value="image">{L("signTabImage")}</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex min-h-[200px] flex-col justify-center gap-2">
          {method === "auto" ? (
            <>
              <div className="flex h-[170px] items-center justify-center rounded-md border border-input bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- a data URL made in the browser */}
                {auto ? <img src={auto} alt={signerName} className="max-h-full max-w-full" /> : null}
              </div>
              <p className="text-sm text-muted-foreground">{L("signAutoNote")}</p>
            </>
          ) : null}
          {method === "drawn" ? <SignaturePad locale={locale} onChange={setDrawn} /> : null}
          {method === "image" ? (
            <>
              <div className="flex h-[170px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input bg-white text-sm text-muted-foreground">
                {uploaded ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a data URL made in the browser
                  <img src={uploaded} alt="" className="max-h-full max-w-full" />
                ) : (
                  <>
                    <Button type="button" variant="outline" onClick={() => file.current?.click()}>
                      {L("signImageChoose")}
                    </Button>
                    <span>{L("signImageHint")}</span>
                  </>
                )}
              </div>
              {uploaded ? (
                <div>
                  <Button type="button" size="sm" variant="outline" onClick={() => file.current?.click()}>
                    {L("signImageChange")}
                  </Button>
                </div>
              ) : null}
              {imageError ? (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {imageError}
                </p>
              ) : null}
              <input ref={file} type="file" accept="image/png,image/jpeg" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e.target.files)} />
            </>
          ) : null}
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id="kyc-online-accept" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
          <Label htmlFor="kyc-online-accept" className="text-sm font-normal leading-snug">
            {L("onlineAccept")}
          </Label>
        </div>
        {presentBy ? <p className="text-sm font-medium">{UI.signedInPresence[locale].replace("{name}", presentBy)}</p> : null}
        {error ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter className="max-sm:gap-2">
          <Button type="button" variant="outline" className="max-sm:h-11" disabled={busy} onClick={() => onOpenChange(false)}>
            {L("signCancel")}
          </Button>
          <Button type="button" className="max-sm:h-11" disabled={busy || !accepted || !image} onClick={() => image && onSubmit(method, image)}>
            {busy ? <CircleNotch className="size-4 animate-spin" /> : null}
            {L("signAndSend")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
