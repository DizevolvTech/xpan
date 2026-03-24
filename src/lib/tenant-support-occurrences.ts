export type TenantSupportOccurrenceStatus =
  | "aberta"
  | "em_analise"
  | "aguardando_cliente"
  | "resolvida"
  | "fechada";

export type TenantSupportOccurrencePriority = "baixa" | "media" | "alta";

export type TenantSupportOccurrenceCategory =
  | "cadastro"
  | "usuarios"
  | "acesso"
  | "financeiro"
  | "operacao"
  | "outro";

export type TenantSupportActorSide = "cliente" | "master" | "sistema";

export type TenantSupportOccurrence = {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  category: TenantSupportOccurrenceCategory;
  priority: TenantSupportOccurrencePriority;
  description: string;
  status: TenantSupportOccurrenceStatus;
  openedByName: string | null;
  openedByRoleLabel: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
};

export type TenantSupportOccurrenceEvent = {
  id: string;
  occurrenceId: string;
  type: string;
  content: string;
  createdAt: string;
  actorName: string | null;
  actorRoleLabel: string | null;
  actorSide: TenantSupportActorSide;
};

export type TenantSupportOccurrenceDetail = TenantSupportOccurrence & {
  canComment: boolean;
  events: TenantSupportOccurrenceEvent[];
};

export type CreateTenantSupportOccurrenceInput = {
  title: string;
  category: TenantSupportOccurrenceCategory;
  priority: TenantSupportOccurrencePriority;
  description: string;
};

export const tenantSupportOccurrenceStatusLabels: Record<
  TenantSupportOccurrenceStatus,
  string
> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  aguardando_cliente: "Aguardando cliente",
  resolvida: "Resolvida",
  fechada: "Fechada",
};

export const tenantSupportOccurrencePriorityLabels: Record<
  TenantSupportOccurrencePriority,
  string
> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const tenantSupportOccurrenceCategoryLabels: Record<
  TenantSupportOccurrenceCategory,
  string
> = {
  cadastro: "Cadastro",
  usuarios: "Usuários",
  acesso: "Acesso",
  financeiro: "Financeiro",
  operacao: "Operação",
  outro: "Outro",
};

export const tenantSupportOccurrenceStatusOptions = Object.entries(
  tenantSupportOccurrenceStatusLabels,
).map(([value, label]) => ({
  value: value as TenantSupportOccurrenceStatus,
  label,
}));

export const tenantSupportOccurrencePriorityOptions = Object.entries(
  tenantSupportOccurrencePriorityLabels,
).map(([value, label]) => ({
  value: value as TenantSupportOccurrencePriority,
  label,
}));

export const tenantSupportOccurrenceCategoryOptions = Object.entries(
  tenantSupportOccurrenceCategoryLabels,
).map(([value, label]) => ({
  value: value as TenantSupportOccurrenceCategory,
  label,
}));

export function isTenantSupportOccurrenceStatus(
  value: unknown,
): value is TenantSupportOccurrenceStatus {
  return (
    value === "aberta" ||
    value === "em_analise" ||
    value === "aguardando_cliente" ||
    value === "resolvida" ||
    value === "fechada"
  );
}

export function isTenantSupportOccurrencePriority(
  value: unknown,
): value is TenantSupportOccurrencePriority {
  return value === "baixa" || value === "media" || value === "alta";
}

export function isTenantSupportOccurrenceCategory(
  value: unknown,
): value is TenantSupportOccurrenceCategory {
  return (
    value === "cadastro" ||
    value === "usuarios" ||
    value === "acesso" ||
    value === "financeiro" ||
    value === "operacao" ||
    value === "outro"
  );
}

export function buildTenantSupportStatusEventContent(
  status: TenantSupportOccurrenceStatus,
) {
  return `Status atualizado para ${tenantSupportOccurrenceStatusLabels[status]}.`;
}

export function canCommentOnTenantSupportOccurrence(
  status: TenantSupportOccurrenceStatus,
) {
  return status !== "fechada";
}

export function canTenantActorUpdateSupportStatus(
  current: TenantSupportOccurrenceStatus,
  next: TenantSupportOccurrenceStatus,
) {
  if (current === next) {
    return false;
  }

  if (current === "resolvida" && next === "fechada") {
    return true;
  }

  return (
    (current === "aguardando_cliente" || current === "fechada") &&
    next === "aberta"
  );
}

export function canMasterActorUpdateSupportStatus(
  current: TenantSupportOccurrenceStatus,
  next: TenantSupportOccurrenceStatus,
) {
  return current !== next;
}

export function describeTenantSupportActorSide(side: TenantSupportActorSide) {
  switch (side) {
    case "cliente":
      return "Cliente";
    case "master":
      return "Administrador Master";
    case "sistema":
      return "Sistema";
    default:
      return "Sistema";
  }
}

export function normalizeTenantSupportOccurrenceDraft(
  input: CreateTenantSupportOccurrenceInput,
) {
  const title = input.title.trim();
  const description = input.description.trim();

  if (title.length < 6) {
    throw new Error("Informe um assunto mais claro para a ocorrência.");
  }

  if (description.length < 12) {
    throw new Error("Descreva a ocorrência com um pouco mais de contexto.");
  }

  return {
    title,
    category: input.category,
    priority: input.priority,
    description,
  };
}
