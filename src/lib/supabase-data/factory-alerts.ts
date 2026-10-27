/**
 * 2.3-D — Alertas visuais de divergência (gestor da fábrica).
 *
 * `computeFactoryAlerts` é uma função PURA que recebe os sinais já calculados
 * por `computeFactoryMetrics` (+ a contagem de lojas sem pedido derivada do
 * planning) e devolve uma lista estruturada de alertas. Mantida desacoplada de
 * I/O de propósito: a tarefa 2.6-F (gatilhos automáticos) vai consumir esta
 * mesma função para decidir quando disparar notificações.
 *
 * Quadro #1 (Lucas, 27/10): alertas de PRODUÇÃO (produzido x planejado e atraso por
 * etapa) saíram — primeiro o básico operacional; capacidade e velocidade ficam para
 * depois. Ficam os alertas de entrega e de lojas sem pedido.
 */

export type FactoryAlertSeverity = "info" | "warning" | "danger";

export interface FactoryAlert {
  id: string;
  severity: FactoryAlertSeverity;
  title: string;
  detail: string;
  /** Texto curto do número/percentual que disparou o alerta (ex.: "72%"). */
  metric: string;
}

/**
 * Limiares de divergência. Constantes nomeadas para a tarefa 2.6-F poder
 * reutilizar/ajustar os mesmos cortes ao disparar gatilhos automáticos.
 */
export const OTIF_WARNING_THRESHOLD = 95; // OTIF < 95% → atenção
export const OTIF_DANGER_THRESHOLD = 80; // OTIF < 80% → crítico

export interface FactoryAlertsInput {
  otif: {
    deliveredOnTime: number;
    deliveredLate: number;
    otifPercent: number;
  };
  deliveryFailuresTotal: number;
  /** Lojas que deveriam ter pedido para a data e estão sem (item 2.6-D). */
  storesWithoutOrder: number;
}

export function computeFactoryAlerts(input: FactoryAlertsInput): FactoryAlert[] {
  const alerts: FactoryAlert[] = [];
  // 1) OTIF / falhas de entrega ----------------------------------------------
  const consideredDeliveries = input.otif.deliveredOnTime + input.otif.deliveredLate;
  if (consideredDeliveries > 0 && input.otif.otifPercent < OTIF_WARNING_THRESHOLD) {
    alerts.push({
      id: "otif-below-threshold",
      severity: input.otif.otifPercent < OTIF_DANGER_THRESHOLD ? "danger" : "warning",
      title: "OTIF abaixo da meta",
      detail: `OTIF em ${input.otif.otifPercent.toFixed(1)}% — ${
        input.otif.deliveredLate
      } entrega(s) fora do prazo no período.`,
      metric: `${input.otif.otifPercent.toFixed(1)}%`,
    });
  }
  if (input.deliveryFailuresTotal > 0) {
    alerts.push({
      id: "delivery-failures",
      severity: "warning",
      title: "Tentativas de entrega falhadas",
      detail: `${input.deliveryFailuresTotal} tentativa(s) de entrega falhada(s) no período.`,
      metric: String(input.deliveryFailuresTotal),
    });
  }

  // 2) Lojas sem pedido no prazo (item 2.6-D) ---------------------------------
  if (input.storesWithoutOrder > 0) {
    alerts.push({
      id: "stores-without-order",
      severity: "warning",
      title: "Lojas sem pedido no prazo",
      detail: `${input.storesWithoutOrder} loja(s) que pedem nesse dia ainda não têm pedido para a data de referência.`,
      metric: String(input.storesWithoutOrder),
    });
  }

  return alerts;
}
