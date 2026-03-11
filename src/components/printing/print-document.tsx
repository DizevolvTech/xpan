"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";

interface PrintDocumentProps {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  children?: ReactNode;
  variant?: "default" | "industrial";
}

export function PrintDocument({ title, subtitle, meta, children, variant = "default" }: PrintDocumentProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print();
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const industrial = variant === "industrial";

  return (
    <main
      className={
        industrial
          ? "min-h-screen bg-stone-200 px-3 py-4 print:bg-white print:px-0 print:py-0"
          : "min-h-screen bg-stone-100 px-4 py-5 print:bg-white print:px-0 print:py-0"
      }
    >
      <div
        className={
          industrial
            ? "mx-auto max-w-[860px] border-[3px] border-stone-700 bg-white shadow-sm print:max-w-none print:border-0 print:shadow-none"
            : "mx-auto max-w-5xl rounded-2xl border border-stone-200 bg-white shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none"
        }
      >
        <header className={industrial ? "border-b border-stone-300 px-6 py-4 print:px-8" : "border-b border-stone-200 px-6 py-5 print:px-8"}>
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
                <h1 className={industrial ? "mt-1 text-[28px] font-bold uppercase leading-tight text-stone-900" : "mt-1 text-2xl font-semibold text-stone-900"}>
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

            {meta ? <div className={industrial ? "grid gap-2 md:grid-cols-3" : "grid gap-3 md:grid-cols-3"}>{meta}</div> : null}
          </div>
        </header>

        <div className={industrial ? "space-y-4 px-6 py-4 print:px-8 print:py-5" : "space-y-6 px-6 py-5 print:px-8 print:py-6"}>
          {children}
        </div>
      </div>
    </main>
  );
}
