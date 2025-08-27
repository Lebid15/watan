// دالة تنسيق 3 منازل عشرية دون تغيير التخزين
export function format3(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(v)) return '0.000';
  return (Math.round((v + Number.EPSILON) * 1000) / 1000).toFixed(3);
}

// تحويل سريع بحسب معدل صرف
export function convertAndFormat3(amount: number | string, rate: number | string): string {
  const a = typeof amount === 'string' ? Number(amount) : amount;
  const r = typeof rate === 'string' ? Number(rate) : rate;
  if (!Number.isFinite(a) || !Number.isFinite(r) || r === 0) return '0.000';
  return format3(a * r);
}