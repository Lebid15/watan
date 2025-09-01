export class CreateDepositDto {
  /** وسيلة الدفع المختارة (قد تكون مطلوبة لاحقًا، حالياً اختيارية لبعض السيناريوهات). */
  methodId?: string;

  /** المبلغ الذي أرسله فعليًا */
  originalAmount: number;

  /** العملة التي أرسل بها (مثل: USD, TRY) */
  originalCurrency: string;

  /** عملة محفظة المستخدم (مثل: TRY) */
  walletCurrency: string;

  /** ملاحظة اختيارية */
  note?: string;

  // لا نسمح بتمرير source من العميل؛ يحدد داخليًا (user_request أو admin_topup)
}
