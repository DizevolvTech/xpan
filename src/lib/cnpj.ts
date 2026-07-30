/**
 * CNPJ alfanumérico — IN RFB 2.229/2024 (altera a IN RFB 2.119/2022).
 *
 * Desde julho/2026 a Receita emite CNPJ com letras. O formato mantém 14
 * posições e a mesma máscara `XX.XXX.XXX/XXXX-DD`:
 *
 *   - posições 1–8  (raiz):  alfanuméricas (0-9 e A-Z maiúsculo)
 *   - posições 9–12 (ordem): alfanuméricas
 *   - posições 13–14 (DV):   sempre numéricas
 *
 * Os CNPJ numéricos antigos continuam válidos para sempre — os dois formatos
 * coexistem, e a atribuição de letras é aleatória (mesmo depois de julho/2026
 * ainda saem inscrições 100% numéricas). Por isso este módulo é um validador
 * só: o mesmo cálculo resolve os dois casos.
 *
 * DV pelo módulo 11, com cada caractere convertido em `ASCII - 48`
 * ('0'→0 … '9'→9, 'A'→17, 'B'→18 … 'Z'→42) e pesos cíclicos 2..9 da direita
 * para a esquerda.
 *
 * Atenção ao usar CNPJ como dado de negócio: o sufixo `0001` deixou de
 * identificar matriz (é só o valor inicial — uma filial pode virar matriz
 * depois) e as letras não carregam UF, natureza jurídica nem qualquer outra
 * informação. Não derive nada da posição dos caracteres.
 */

const CNPJ_LENGTH = 14;
const CNPJ_BASE_LENGTH = 12;
/** 12 posições alfanuméricas + 2 dígitos verificadores numéricos. */
const CNPJ_SHAPE = /^[0-9A-Z]{12}[0-9]{2}$/;

/** Valor decimal do caractere no módulo 11: código ASCII menos 48. */
function charValue(char: string) {
  return char.charCodeAt(0) - 48;
}

/**
 * Normaliza para a forma canônica de armazenamento e comparação: 14 posições,
 * sem máscara, em caixa alta. Toda persistência e toda chave de busca devem
 * usar esta forma — senão `12.ABC.345/01DE-35` e `12ABC34501DE35` viram
 * registros distintos.
 */
export function normalizeCnpj(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function computeCheckDigit(base: string) {
  let sum = 0;

  for (let index = base.length - 1, weight = 2; index >= 0; index -= 1) {
    sum += charValue(base[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  return String(remainder < 2 ? 0 : 11 - remainder);
}

/**
 * Calcula os dois dígitos verificadores a partir das 12 primeiras posições
 * (já normalizadas). Devolve string vazia quando a base é inválida.
 */
export function computeCnpjCheckDigits(base: string) {
  const normalizedBase = normalizeCnpj(base);

  if (normalizedBase.length !== CNPJ_BASE_LENGTH) {
    return "";
  }

  const firstDigit = computeCheckDigit(normalizedBase);
  return `${firstDigit}${computeCheckDigit(`${normalizedBase}${firstDigit}`)}`;
}

/** Aceita CNPJ numérico (legado) e alfanumérico, com ou sem máscara. */
export function isValidCnpj(value: string | null | undefined) {
  const cnpj = normalizeCnpj(value);

  if (cnpj.length !== CNPJ_LENGTH || !CNPJ_SHAPE.test(cnpj)) {
    return false;
  }

  const base = cnpj.slice(0, CNPJ_BASE_LENGTH);

  // Base com um único caractere repetido (00000000000, AAAAAAAAAAAA…) fecha o
  // módulo 11 mas nunca é inscrição real.
  if (/^(.)\1{11}$/.test(base)) {
    return false;
  }

  return cnpj.slice(CNPJ_BASE_LENGTH) === computeCnpjCheckDigits(base);
}

export const INVALID_CNPJ_MESSAGE =
  "Informe um CNPJ válido. O formato alfanumérico tem 14 posições (letras e números) com dois dígitos verificadores numéricos no final.";

/**
 * Converte a entrada do usuário na forma canônica de persistência. Campo vazio
 * vira `null` (CNPJ é opcional no cadastro); entrada preenchida e inválida
 * lança — use no servidor, antes de qualquer insert/update, porque a validação
 * do formulário é contornável.
 */
export function resolveCnpjForStorage(value: string | null | undefined) {
  const cnpj = normalizeCnpj(value);

  if (!cnpj) {
    return null;
  }

  if (!isValidCnpj(cnpj)) {
    throw new Error(INVALID_CNPJ_MESSAGE);
  }

  return cnpj;
}

/** Aplica `XX.XXX.XXX/XXXX-DD`. Devolve a entrada quando não há 14 posições. */
export function formatCnpj(value: string | null | undefined) {
  const cnpj = normalizeCnpj(value);

  if (cnpj.length !== CNPJ_LENGTH) {
    return value ?? "";
  }

  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

/**
 * Máscara progressiva para `onChange` de input. Faz uppercase e descarta o
 * excedente além das 14 posições.
 *
 * O input correspondente NÃO pode ser `type="number"` nem `inputMode="numeric"`
 * — o usuário precisa conseguir digitar letras.
 */
export function maskCnpjInput(value: string) {
  const cnpj = normalizeCnpj(value).slice(0, CNPJ_LENGTH);

  if (cnpj.length <= 2) {
    return cnpj;
  }

  let masked = `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}`;

  if (cnpj.length > 5) {
    masked += `.${cnpj.slice(5, 8)}`;
  }

  if (cnpj.length > 8) {
    masked += `/${cnpj.slice(8, 12)}`;
  }

  if (cnpj.length > 12) {
    masked += `-${cnpj.slice(12)}`;
  }

  return masked;
}
