"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type ShareQrProps = {
  url: string;
  label?: string;
};

export function ShareQr({ url, label = "QR-Code für Gäste" }: ShareQrProps) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!url) {
      setSrc("");
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      color: { dark: "#111111", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then((data) => {
      if (!cancelled) setSrc(data);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return null;

  return (
    <figure className="space-y-2 rounded-2xl bg-white p-4 text-neutral-900 ring-1 ring-border print:bg-white">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={label}
          className="mx-auto size-56 max-w-full rounded-xl bg-white sm:size-64"
        />
      ) : (
        <div className="mx-auto size-56 rounded-xl bg-muted sm:size-64" />
      )}
      <figcaption className="text-center text-sm font-medium leading-snug">
        {label}
      </figcaption>
      <p className="break-all text-center text-[0.7rem] leading-snug text-muted-foreground print:text-neutral-700">
        {url}
      </p>
    </figure>
  );
}
