"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DeliveryFailureReason } from "@/lib/delivery-execution";

// AJ-A3: motivo estruturado de falha em entrega. Mantém o operador honesto e
// dá métricas (qual motivo mais comum, qual loja com mais falhas, etc.) para
// futuros relatórios de OTIF.
const REASON_OPTIONS: Array<{ value: DeliveryFailureReason; label: string }> = [
  { value: "cliente_ausente", label: "Cliente ausente" },
  { value: "endereco_errado", label: "Endereço errado" },
  { value: "recusa_cliente", label: "Recusa do cliente" },
  { value: "estabelecimento_fechado", label: "Estabelecimento fechado" },
  { value: "veiculo_avaria", label: "Avaria no veículo" },
  { value: "acesso_bloqueado", label: "Acesso bloqueado" },
  { value: "documentacao_pendente", label: "Documentação pendente" },
  { value: "outro", label: "Outro motivo" },
];

interface DeliveryAttemptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderCode: string | null;
  storeName: string | null;
  onSubmit: (input: {
    reason: DeliveryFailureReason;
    notes: string | null;
    rescheduleTo: string | null;
  }) => Promise<void>;
}

export function DeliveryAttemptDialog({
  open,
  onOpenChange,
  orderCode,
  storeName,
  onSubmit,
}: DeliveryAttemptDialogProps) {
  // O componente é montado/desmontado pelo consumer via render condicional —
  // estado sempre fresco ao abrir, sem useEffect de reset (anti-pattern).
  const [reason, setReason] = useState<DeliveryFailureReason | "">("");
  const [notes, setNotes] = useState("");
  const [rescheduleTo, setRescheduleTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isValid = reason !== "";

  async function handleConfirm() {
    if (!isValid) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onSubmit({
        reason: reason as DeliveryFailureReason,
        notes: notes.trim().length > 0 ? notes.trim() : null,
        rescheduleTo: rescheduleTo.trim().length > 0 ? rescheduleTo : null,
      });
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao registrar tentativa.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Registrar tentativa de entrega</DialogTitle>
          <DialogDescription>
            {orderCode && storeName
              ? `Pedido ${orderCode} — ${storeName}. Registre o motivo da falha para preservar o histórico e habilitar reagendamento.`
              : "Registre o motivo da falha para preservar o histórico e habilitar reagendamento."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="delivery-attempt-reason">Motivo da falha</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as DeliveryFailureReason)}>
              <SelectTrigger id="delivery-attempt-reason">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="delivery-attempt-notes">Observação (opcional)</Label>
            <Textarea
              id="delivery-attempt-notes"
              placeholder="Detalhes adicionais que ajudem o gestor a reagendar (ex: cliente pediu pra voltar amanhã às 10h)."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="delivery-attempt-reschedule">Reagendar para (opcional)</Label>
            <Input
              id="delivery-attempt-reschedule"
              type="date"
              value={rescheduleTo}
              onChange={(event) => setRescheduleTo(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Vazio = gestor escolhe a próxima janela manualmente.
            </p>
          </div>

          {errorMessage ? (
            <p className="text-xs font-medium text-destructive">{errorMessage}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={!isValid || submitting}
          >
            {submitting ? "Registrando..." : "Registrar falha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
