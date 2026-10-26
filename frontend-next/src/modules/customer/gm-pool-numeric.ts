import type { GmPackage } from "./gm-pool-constants";

export type GmNumericValues = {
  pkrAmountNum: number;
  dollarRateNum: number;
  alibabaDiscountNum: number;
  packagePrice: number;
  orderDollar: number;
  finalOrderDollar: number;
  customerDollar: number;
  extraDollarDiscount: number;
  extraDiscountPkr: number;
  extraDiscountPercentage: number;
};

export function computeGmNumericValues(
  pkrAmount: string,
  dollarRate: string,
  alibabaDiscount: string,
  selectedPackage: GmPackage | undefined,
): GmNumericValues {
  const pkrAmountNum = Number(pkrAmount) || 0;
  const dollarRateNum = Number(dollarRate) || 0;
  const alibabaDiscountNum = Number(alibabaDiscount) || 0;
  const packagePrice = selectedPackage?.priceUsd ?? 0;
  const orderDollar = selectedPackage?.orderDollar ?? packagePrice;
  const finalOrderDollar = Math.max(0, orderDollar - alibabaDiscountNum);
  const customerDollar =
    pkrAmountNum > 0 && dollarRateNum > 0 ? Number((pkrAmountNum / dollarRateNum).toFixed(2)) : 0;
  const extraDollarDiscount = Number((finalOrderDollar - customerDollar).toFixed(2));
  const extraDiscountPkr = Number((extraDollarDiscount * dollarRateNum).toFixed(2));
  const extraDiscountPercentage = finalOrderDollar > 0 ? (extraDollarDiscount / finalOrderDollar) * 100 : 0;
  return {
    pkrAmountNum,
    dollarRateNum,
    alibabaDiscountNum,
    packagePrice,
    orderDollar,
    finalOrderDollar,
    customerDollar,
    extraDollarDiscount,
    extraDiscountPkr,
    extraDiscountPercentage,
  };
}

export type GmLoanRow = { dollar: string; pkrAmount: string; chequeNo: string; payDate: string };

export const EMPTY_GM_LOAN_ROW: GmLoanRow = { dollar: "", pkrAmount: "", chequeNo: "", payDate: "" };
