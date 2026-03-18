"use client";

import { CalendarRange } from "lucide-react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OperationalDateScope, OperationalDateScopeMode } from "@/lib/operational-date-scope";

interface OperationalDateScopeCardProps {
  scope: OperationalDateScope;
  summary: string;
  setMode: (mode: OperationalDateScopeMode) => void;
  setDate: (date: string) => void;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  title?: string;
  description?: string;
  extraControls?: React.ReactNode;
}

export function OperationalDateScopeCard({
  scope,
  summary,
  setMode,
  setDate,
  setStartDate,
  setEndDate,
  title = "Janela operacional",
  description = "Escolha se quer ver todo o período, um dia específico ou um intervalo fechado.",
  extraControls,
}: OperationalDateScopeCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <CalendarRange className="size-4" />
            {title}
          </div>
          <CardTitle className="text-base">Filtro temporal global</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="text-xs font-medium text-foreground">{summary}</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {extraControls}

          <div className="min-w-[180px] space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Modo</p>
            <Select value={scope.mode} onValueChange={(value) => setMode(value as OperationalDateScopeMode)}>
              <SelectTrigger className="bg-background/80">
                <SelectValue placeholder="Selecionar modo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo o período</SelectItem>
                <SelectItem value="day">Data específica</SelectItem>
                <SelectItem value="range">Período fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope.mode === "day" ? (
            <div className="min-w-[180px] space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Data</p>
              <Input type="date" value={scope.date} onChange={(event) => setDate(event.target.value)} />
            </div>
          ) : null}

          {scope.mode === "range" ? (
            <>
              <div className="min-w-[180px] space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">De</p>
                <Input
                  type="date"
                  value={scope.startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="min-w-[180px] space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Até</p>
                <Input
                  type="date"
                  value={scope.endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </>
          ) : null}
        </div>
      </CardHeader>
    </Card>
  );
}
