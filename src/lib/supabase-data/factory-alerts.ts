import type { LeadTimePerStage } from "@/lib/supabase-data/factory-metrics";

/**
 * 2.3-D — Alertas visuais de divergência (gestor da fábrica).
 *
 * `computeFactoryAlerts` é uma função PURA que recebe os sinais já calculados
 * por `computeFactoryMetrics` (+ a contagem de lojas sem pedido derivada do
 * planning) e devolve uma lista estruturada de alertas. Mantida desacoplada de
 * I/O de propósito: a tarefa 2.6-F (gatilhos automáticos) vai consumir esta
 * mesma função para decidir quando disparar notificações.
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
export const PRODUCED_VS_PLANNED_UNDER_THRESHOLD = 0.8; // < 80% do planejado → alerta
export const PRODUCED_VS_PLANNED_OVER_THRESHOLD = 1.2; // > 120% do planejado → alerta
export const STAGE_DELAY_MARGIN_PERCENT = 50; // etapa > média entre etapas + 50% → alerta
export const STAGE_DELAY_MIN_SAMPLES = 2; // ignora etapas com amostra insuficiente
export const OTIF_WARNING_THRESHOLD = 95; // OTIF < 95% → atenção
export const OTIF_DANGER_THRESHOLD = 80; // OTIF < 80% → crítico

export interface FactoryAlertsInput {
  /** kg planejados (agendados) para a data de referência — soma das linhas. */
  scheduledKg: number;
  /** kg efetivamente produzidos (itens que chegaram a `concluido`) no dia. */
  producedKg: number;
  /** Lead time médio por etapa (já computado em computeFactoryMetrics). */
  leadTimePerStage: LeadTimePerStage[];
  /** Lead time médio total (minutos) — base de comparação para atraso de etapa. */
  averageTotalMinutes: number;
  otif: {
    deliveredOnTime: number;
    deliveredLate: number;
    otifPercent: number;
  };
  deliveryFailuresTotal: number;
  /** Lojas que deveriam ter pedido para a data e estão sem (item 2.6-D). */
  storesWithoutOrder: number;
  /** Mapa estágio → rótulo PT-BR (compartilhado com o card de métricas). */
  stageLabels?: Record<string, string>;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes - hours * 60);
  return rest > 0 ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

export function computeFactoryAlerts(input: FactoryAlertsInput): FactoryAlert[] {
  const alerts: FactoryAlert[] = [];
  const stageLabel = (stage: string) => input.stageLabels?.[stage] ?? stage;

  // 1) Quantidade produzida vs planejada -------------------------------------
  // Só faz sentido comparar quando há plano para o dia.
  if (input.scheduledKg > 0) {
    const ratio = input.producedKg / input.scheduledKg;
    const percent = Math.round(ratio * 100);
    if (ratio < PRODUCED_VS_PLANNED_UNDER_THRESHOLD) {
      alerts.push({
        id: "produced-below-planned",
        severity: ratio < PRODUCED_VS_PLANNED_UNDER_THRESHOLD / 2 ? "danger" : "warning",
        title: "Produção abaixo do planejado",
        detail: `Produzido ${input.producedKg.toFixed(0)} kg de ${input.scheduledKg.toFixed(
          0,
        )} kg planejados (${percent}%).`,
        metric: `${percent}%`,
      });
    } else if (ratio > PRODUCED_VS_PLANNED_OVER_THRESHOLD) {
      alerts.push({
        id: "produced-above-planned",
        severity: "warning",
        title: "Produção acima do planejado",
        detail: `Produzido ${input.producedKg.toFixed(0)} kg de ${input.scheduledKg.toFixed(
          0,
        )} kg planejados (${percent}%).`,
        metric: `${percent}%`,
      });
    }
  }

  // 2) Atraso por etapa -------------------------------------------------------
  // Etapa cuja média excede a MÉDIA ENTRE AS ETAPAS + margem. Comparar contra a
  // média total ponta-a-ponta (soma das etapas) seria incorreto: cada etapa é
  // uma parcela do total e quase nunca o excederia. A linha de base é a média
  // das etapas com amostra suficiente — assim destacamos a etapa gargalo.
  const stagesWithSamples = input.leadTimePerStage.filter(
    (row) => row.samples >= STAGE_DELAY_MIN_SAMPLES && row.averageMinutes > 0,
  );
  if (stagesWithSamples.length > 1) {
    const meanStageMinutes =
      stagesWithSamples.reduce((sum, row) => sum + row.averageMinutes, 0) /
      stagesWithSamples.length;
    const limit = meanStageMinutes * (1 + STAGE_DELAY_MARGIN_PERCENT / 100);
    stagesWithSamples
      .filter((row) => row.averageMinutes > limit)
      .forEach((row) => {
        alerts.push({
          id: `stage-delay-${row.stage}`,
          severity: row.averageMinutes > limit * 1.5 ? "danger" : "warning",
          title: `Atraso na etapa "${stageLabel(row.stage)}"`,
          detail: `Média de ${formatMinutes(row.averageMinutes)} nessa etapa contra ${formatMinutes(
            meanStageMinutes,
          )} de média entre etapas (${row.samples} amostra(s)).`,
          metric: formatMinutes(row.averageMinutes),
        });
      });
  }

  // 3) OTIF / falhas de entrega ----------------------------------------------
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

  // 4) Lojas sem pedido no prazo (item 2.6-D) ---------------------------------
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
