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
          /* A margem SUPERIOR maior é o que reserva a faixa do cabeçalho que repete em toda
             página (.print-running-header, fixado no topo). Margem de @page vale por PÁGINA,
             então a reserva existe da 1ª à última — diferente de um padding no container. */
          margin: 18mm 6mm 6mm;
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

          /* Cabeçalho que REPETE em toda página impressa, como na ficha do cliente (a página 2
             traz linha, produzir e entregar de novo). Sem isso, quem pega a folha 2 de uma OP
             longa não sabe de qual OP nem de que dia ela é.
             position:fixed dentro de @media print é o que faz o navegador repetir o bloco em
             cada página; o padding-top no container reserva a altura para o conteúdo não
             passar por baixo dele. */
          .print-doc .print-running-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: white;
            /* A reserva de espaço é a margem de @page abaixo, NÃO um padding no container:
               padding de bloco em fluxo só empurra o conteúdo onde o bloco começa (página 1);
               da página 2 em diante o fluxo recomeça no topo e passaria por baixo do header. */
          }
          .print-doc h1 {
            font-size: 17px !important;
            margin: 0 !important;
          }

          /* AJ — economia de papel: os utilitários de fonte do Tailwind
             (text-sm/base/lg/xl) trazem font-size próprio e venciam o
             .print-doc base (10.5px), mantendo o conteúdo grande na folha.
             Reduzimos SÓ na impressão, com piso de legibilidade pro chão e
             line-height apertado. Negrito/cor/bordas permanecem intactos. */
          .print-doc .text-sm {
            font-size: 9.5px !important;
            line-height: 1.1 !important;
          }
          .print-doc .text-base {
            font-size: 10.5px !important;
            line-height: 1.1 !important;
          }
          .print-doc .text-lg {
            font-size: 12px !important;
            line-height: 1.05 !important;
          }
          .print-doc .text-xl {
            font-size: 13px !important;
            line-height: 1.05 !important;
          }
          .print-doc .text-2xl {
            font-size: 14px !important;
            line-height: 1.05 !important;
          }

          /* As linhas de ingrediente são o maior volume da folha: densamente
             apertadas (9.5px ainda legível, padding mínimo). Sobrepõe o text-sm
             dos <td> e o padding anterior. */
          .print-doc table th,
          .print-doc table td {
            font-size: 9.5px !important;
            line-height: 1.1 !important;
            padding: 1px 4px !important;
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
          .print-doc .space-y-1\.5 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 2px !important;
          }

          /* AJ — economia de papel: o padding generoso de cards, cabeçalhos de
             seção e blocos por produto é o maior consumidor de altura por folha.
             A tela mantém o respiro; só a impressão fica densa. Escopo .print-doc. */
          .print-doc .py-5,
          .print-doc .py-4 {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
          }
          .print-doc .py-3 {
            padding-top: 2.5px !important;
            padding-bottom: 2.5px !important;
          }
          .print-doc .py-2 {
            padding-top: 1.5px !important;
            padding-bottom: 1.5px !important;
          }
          .print-doc .px-4 {
            padding-left: 6px !important;
            padding-right: 6px !important;
          }
          .print-doc .px-3 {
            padding-left: 5px !important;
            padding-right: 5px !important;
          }
          .print-doc .mt-1 {
            margin-top: 1px !important;
          }
          /* Cantos arredondados não economizam tinta nem papel — achata na folha. */
          .print-doc .rounded-2xl,
          .print-doc .rounded-xl,
          .print-doc .rounded-lg {
            border-radius: 0 !important;
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
        {industrial ? (
          // Cabeçalho enxuto: só o nome da linha (title) + uma linha minúscula de
          // contexto (documento/data) pra folha de chão não ficar sem data. Sem
          // logo/marca/setor/cartões — economia máxima de altura por folha.
          // `print-running-header` repete este cabeçalho no topo de CADA página impressa. Na
          // ficha do cliente ele repete (a página 2 traz linha, produzir e entregar de novo), e
          // faz diferença no chão: quem pega a folha 2 de uma OP longa precisa saber de qual OP
          // e de que dia ela é. Ver a regra em `globals.css`.
          <header className="print-running-header flex items-center justify-between gap-3 border-b-2 border-stone-700 px-4 py-2 print:px-4 print:py-1">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold uppercase leading-none text-stone-900">{title}</h1>
              {meta ? (
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-stone-500 print:mt-0.5">
                  {meta}
                </div>
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
          </header>
        ) : (
          <header className="border-b border-stone-200 px-6 py-5 print:px-6 print:py-3">
            <div className="flex flex-col gap-4 print:block">
              <div className="flex items-start justify-between gap-4 print:block">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <Image
                      src={brand.logoPath}
                      alt={brand.name}
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain"
                      priority
                    />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                      {brand.name}
                    </p>
                  </div>
                  <h1 className="mt-1 text-2xl font-semibold text-stone-900 print:text-lg">{title}</h1>
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

              {meta ? <div className="grid gap-3 md:grid-cols-3 print:gap-1.5">{meta}</div> : null}
            </div>
          </header>
        )}

        <div className={industrial ? "space-y-4 px-6 py-4 print:space-y-2 print:px-6 print:py-3" : "space-y-6 px-6 py-5 print:space-y-3 print:px-6 print:py-3"}>
          {children}
        </div>
      </div>
      </main>
    </>
  );
}
