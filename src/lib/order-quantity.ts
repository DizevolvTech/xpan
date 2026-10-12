import type { UnitCode } from "@/lib/factory-planning/units";
import { isDiscreteUnit } from "@/lib/factory-planning/units";

/**
 * Leitura de quantidade vinda de planilha ou digitação (padrão brasileiro).
 *
 * Por que existe: `"1.000"` virava `1` (ponto lido como decimal) — um pedido de mil virava um,
 * sem aviso. Aqui o ponto com exatamente três casas é MILHAR; quando isso é ambíguo (produto
 * contínuo, onde 1,500 kg também seria plausível) a leitura vira AVISO e a tela exige
 * conferência antes de confirmar. Erro silencioso de 1.000x é o pior caso e não pode acontecer.
 */
export type ParsedOrderQuantity =
  | { ok: true; value: number; warning?: string }
  | { ok: false; message: string };

const MAX_QUANTITY = 999_999_999;

/** Unidades escritas junto do número ("12 un", "5 kg"). Nome normalizado → unidade do sistema. */
const unitAliases: Record<string, "Un" | "Kg" | "L"> = {
  un: "Un", und: "Un", unid: "Un", unidade: "Un", unidades: "Un", pc: "Un", pcs: "Un", pç: "Un", peca: "Un", pecas: "Un", peça: "Un", peças: "Un",
  kg: "Kg", kgs: "Kg", quilo: "Kg", quilos: "Kg", quilograma: "Kg", quilogramas: "Kg",
  l: "L", lt: "L", lts: "L", litro: "L", litros: "L",
};

/** "mil", "2 mil"… — para o aviso não depender de o gestor distinguir 1.000 de 1,000. */
function wordsForThousands(value: number) {
  const thousands = value / 1000;
  return Number.isInteger(thousands) ? (thousands === 1 ? "mil" : `${thousands} mil`) : `${value.toLocaleString("pt-BR")}`;
}

function finish(value: number, warning?: string): ParsedOrderQuantity {
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message: "Quantidade deve ser maior que zero." };
  }
  if (value > MAX_QUANTITY) return { ok: false, message: "Quantidade acima do limite permitido." };
  if (Math.abs(value * 1000 - Math.round(value * 1000)) > 0.00001) {
    return { ok: false, message: "Quantidade aceita no máximo três casas decimais." };
  }
  return { ok: true, value, ...(warning ? { warning } : {}) };
}

export function parseOrderQuantity(raw: number | string, productUnit?: UnitCode): ParsedOrderQuantity {
  if (typeof raw === "number") return finish(raw);

  let text = String(raw ?? "").replace(/\u00a0/g, " ").trim();
  if (!text) return { ok: false, message: "Quantidade em branco." };

  // Unidade escrita junto do número: só aceita se bater com a unidade do produto.
  const withUnit = /^([0-9][0-9.,]*)\s*([\p{L}.]+)$/u.exec(text);
  if (withUnit) {
    const token = withUnit[2].replace(/\.$/, "").toLocaleLowerCase("pt-BR");
    const unit = unitAliases[token];
    if (!unit) {
      return { ok: false, message: `Unidade "${withUnit[2]}" não reconhecida. Informe só o número, na unidade do produto.` };
    }
    if (productUnit && unit !== productUnit) {
      return { ok: false, message: `Quantidade em ${unit}, mas este produto é pedido em ${productUnit}. Converta antes de importar.` };
    }
    text = withUnit[1];
  }

  if (!/^[0-9][0-9.,]*$/.test(text)) {
    return { ok: false, message: `Quantidade "${text}" inválida. Use só o número (ex.: 12 ou 1,5).` };
  }

  const dots = (text.match(/\./g) ?? []).length;
  const commas = (text.match(/,/g) ?? []).length;
  const discrete = productUnit ? isDiscreteUnit(productUnit) : false;

  // 1.234,56  (milhar com ponto, decimal com vírgula)
  if (dots > 0 && commas > 0) {
    if (/^[1-9][0-9]{0,2}(\.[0-9]{3})+,[0-9]+$/.test(text)) {
      return finish(Number(text.replace(/\./g, "").replace(",", ".")));
    }
    return { ok: false, message: `Quantidade "${text}" em formato misto ambíguo. Use 1.234,5 ou 1234,5.` };
  }
  if (commas > 1) return { ok: false, message: `Quantidade "${text}" inválida: mais de uma vírgula.` };
  if (commas === 1) {
    if (!/^[0-9]+,[0-9]+$/.test(text)) return { ok: false, message: `Quantidade "${text}" inválida.` };
    return finish(Number(text.replace(",", ".")));
  }
  if (dots > 1) {
    if (/^[1-9][0-9]{0,2}(\.[0-9]{3})+$/.test(text)) return finish(Number(text.replace(/\./g, "")));
    return { ok: false, message: `Quantidade "${text}" inválida: pontos fora do padrão de milhar.` };
  }
  if (dots === 1) {
    // "1.000": exatamente 3 casas, sem zero à esquerda → milhar (padrão brasileiro).
    if (/^[1-9][0-9]{0,2}\.[0-9]{3}$/.test(text)) {
      const value = Number(text.replace(".", ""));
      if (discrete) return finish(value);
      return finish(
        value,
        `"${text}" foi lido como ${value.toLocaleString("pt-BR")} (${wordsForThousands(value)}, com ponto de milhar). Se a intenção era ${text.replace(".", ",")} ${productUnit ?? ""}, corrija na planilha.`.replace(/\s+\./, "."),
      );
    }
    if (!/^[0-9]+\.[0-9]+$/.test(text)) return { ok: false, message: `Quantidade "${text}" inválida.` };
    return finish(Number(text));
  }
  return finish(Number(text));
}
