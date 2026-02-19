"use client";

import type { OrderStatus } from "@/lib/order-planning";
import { ORDER_STATUS_OPTIONS } from "@/lib/factory-order-status";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OrderStatusControlProps {
  orderId: string;
  status: OrderStatus;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  compact?: boolean;
  className?: string;
}

export function OrderStatusControl({
  orderId,
  status,
  onStatusChange,
  compact = false,
  className,
}: OrderStatusControlProps) {
  return (
    <Select value={status} onValueChange={(value) => onStatusChange(orderId, value as OrderStatus)}>
      <SelectTrigger
        size={compact ? "sm" : "default"}
        className={cn(
          "bg-background",
          compact ? "min-w-[148px] text-xs" : "min-w-[190px]",
          className,
        )}
        aria-label="Alterar status do pedido"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ORDER_STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
