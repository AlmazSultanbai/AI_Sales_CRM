/** Единые правила отображения чисел, денег и склонений во всём приложении. */

const CURRENCY_SUFFIX = "с";

/**
 * Деньги: целые суммы без копеек, дробные — всегда с двумя знаками.
 * 13000 → «13 000 с», 466359.1 → «466 359,10 с»
 */
export function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  const fractionDigits = Number.isInteger(safe) ? 0 : 2;

  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safe);

  return `${formatted} ${CURRENCY_SUFFIX}`;
}

/** Количество: без лишних нулей, но не длиннее двух знаков после запятой. */
export function formatQuantity(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(safe);
}

/**
 * Русское склонление по числу: pluralRu(1, ["позиция", "позиции", "позиций"]) → «позиция».
 */
export function pluralRu(count: number, forms: [string, string, string]) {
  const abs = Math.abs(Math.trunc(count));
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** «61 позиция», «327 заказов», «580 операций» */
export function countWithWord(count: number, forms: [string, string, string]) {
  return `${new Intl.NumberFormat("ru-RU").format(count)} ${pluralRu(count, forms)}`;
}
