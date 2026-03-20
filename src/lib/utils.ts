import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type LocaleNumberOptions = {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  fallback?: string
}

function getLocaleNumberFormatter({
  minimumFractionDigits,
  maximumFractionDigits,
}: LocaleNumberOptions = {}) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits,
    maximumFractionDigits,
  })
}

export function formatLocaleNumber(
  value: number | null | undefined,
  { fallback = "-", ...options }: LocaleNumberOptions = {},
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return getLocaleNumberFormatter(options).format(value)
}

export function formatKgValue(value: number | null | undefined, options?: LocaleNumberOptions) {
  return formatLocaleNumber(value, {
    maximumFractionDigits: 3,
    ...options,
  })
}

export function formatKgLabel(value: number | null | undefined, options?: LocaleNumberOptions) {
  return `${formatKgValue(value, options)} Kg`
}
