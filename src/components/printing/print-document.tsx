"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PrintDocumentProps {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  children?: ReactNode;
}

export function PrintDocument({ title, subtitle, meta, children }: PrintDocumentProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print();
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-5 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl rounded-2xl border border-stone-200 bg-white shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <header className="border-b border-stone-200 px-6 py-5 print:px-8">
          <div className="flex flex-col gap-4 print:block">
            <div className="flex items-start justify-between gap-4 print:block">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Casa Express</p>
                <h1 className="mt-1 text-2xl font-semibold text-stone-900">{title}</h1>
                {subtitle ? <p className="mt-1 text-sm text-stone-600">{subtitle}</p> : null}
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

            {meta ? <div className="grid gap-3 md:grid-cols-3">{meta}</div> : null}
          </div>
        </header>

        <div className="space-y-6 px-6 py-5 print:px-8 print:py-6">{children}</div>
      </div>
    </main>
  );
}
