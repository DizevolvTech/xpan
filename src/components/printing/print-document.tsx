"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";

interface PrintDocumentProps {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  children?: ReactNode;
  variant?: "default" | "industrial";
  autoPrint?: boolean;
}

async function waitForPrintableDocument(container: HTMLElement | null) {
  if (!container) {
    return;
  }

  if ("fonts" in document && "ready" in document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness failures and continue with the print flow.
    }
  }

  const images = Array.from(container.querySelectorAll("img"));
  if (images.length > 0) {
    await Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }

            const cleanup = () => {
              image.removeEventListener("load", cleanup);
              image.removeEventListener("error", cleanup);
              resolve();
            };

            image.addEventListener("load", cleanup, { once: true });
            image.addEventListener("error", cleanup, { once: true });
          }),
      ),
    );
  }

  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

export function PrintDocument({
  title,
  subtitle,
  meta,
  children,
  variant = "default",
  autoPrint = false,
}: PrintDocumentProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const hasAutoPrintedRef = useRef(false);

  useEffect(() => {
    if (!autoPrint || hasAutoPrintedRef.current) {
      return;
    }

    let cancelled = false;

    async function triggerPrint() {
      await waitForPrintableDocument(rootRef.current);

      if (cancelled || hasAutoPrintedRef.current) {
        return;
      }

      hasAutoPrintedRef.current = true;
      window.print();
    }

    void triggerPrint();

    return () => {
      cancelled = true;
    };
  }, [autoPrint]);

  const industrial = variant === "industrial";

  return (
    <>
      <style jsx global>{`
        @page {
          size: auto;
          margin: 7mm 7mm;
        }

        @media print {
          html,
          body {
            background: white !important;
          }

          /* AJ-0010: densidade "estilo planilha" — mais conteúdo por folha,
             mantendo legibilidade. Escopo restrito ao documento de impressão. */
          .print-doc {
            font-size: 10.5px;
            line-height: 1.2;
          }
          .print-doc h1 {
            font-size: 17px !important;
            margin: 0 !important;
          }
          .print-doc table th,
          .print-doc table td {
            padding: 2px 6px !important;
          }
          .print-doc table {
            font-size: 10.5px;
          }
          /* Comprime o ritmo vertical interno das páginas (espelha o seletor
             do Tailwind space-y, restrito à impressão). */
          .print-doc .space-y-6 > :not([hidden]) ~ :not([hidden]),
          .print-doc .space-y-4 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 6px !important;
          }
          .print-doc .space-y-3 > :not([hidden]) ~ :not([hidden]),
          .print-doc .space-y-2 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 3px !important;
          }
        }
      `}</style>

      <main
        ref={rootRef}
        className={
          industrial
            ? "print-doc min-h-screen bg-stone-200 px-3 py-4 print:bg-white print:px-[4mm] print:py-[3mm]"
            : "print-doc min-h-screen bg-stone-100 px-4 py-5 print:bg-white print:px-[4mm] print:py-[3mm]"
        }
      >
      <div
        className={
          industrial
            ? "mx-auto max-w-[860px] border-[3px] border-stone-700 bg-white shadow-sm print:max-w-none print:border-0 print:shadow-none"
            : "mx-auto max-w-5xl rounded-2xl border border-stone-200 bg-white shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none"
        }
      >
        <header className={industrial ? "border-b border-stone-300 px-6 py-4 print:px-6 print:py-2" : "border-b border-stone-200 px-6 py-5 print:px-6 print:py-3"}>
          <div className="flex flex-col gap-4 print:block">
            <div className="flex items-start justify-between gap-4 print:block">
              <div className={industrial ? "flex-1 text-center" : undefined}>
                <div className={industrial ? "mb-2 flex items-center justify-center gap-3" : "mb-2 flex items-center gap-3"}>
                  <Image
                    src={brand.logoPath}
                    alt={brand.name}
                    width={industrial ? 40 : 32}
                    height={industrial ? 40 : 32}
                    className={industrial ? "h-10 w-10 object-contain" : "h-8 w-8 object-contain"}
                    priority
                  />
                  <p className={industrial ? "text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500" : "text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500"}>
                    {brand.name}
                  </p>
                </div>
                <h1 className={industrial ? "mt-1 text-[28px] font-bold uppercase leading-tight text-stone-900 print:text-[20px]" : "mt-1 text-2xl font-semibold text-stone-900 print:text-lg"}>
                  {title}
                </h1>
                {subtitle ? (
                  <p className={industrial ? "mt-1 text-sm font-semibold uppercase tracking-[0.04em] text-stone-600" : "mt-1 text-sm text-stone-600"}>
                    {subtitle}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2 print:hidden">
                <Button type="button" variant="outline" onClick={() => window.print()}>
                  <Printer className="size-4" />
                  Imprimir
                </Button>
                <Button type="button" variant="ghost" onClick={() => window.close()}>
                  Fechar
                </Button>
              </div>
            </div>

            {meta ? <div className={industrial ? "grid gap-2 md:grid-cols-3 print:gap-1.5" : "grid gap-3 md:grid-cols-3 print:gap-1.5"}>{meta}</div> : null}
          </div>
        </header>

        <div className={industrial ? "space-y-4 px-6 py-4 print:space-y-2 print:px-6 print:py-3" : "space-y-6 px-6 py-5 print:space-y-3 print:px-6 print:py-3"}>
          {children}
        </div>
      </div>
      </main>
    </>
  );
}
