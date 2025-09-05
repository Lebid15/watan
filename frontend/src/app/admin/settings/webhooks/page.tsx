import React from 'react';
import AdminShell from '../../../../components/admin/AdminShell';

export default function WebhooksSettingsPage() {
  return (
    <AdminShell title="Webhooks Settings">
      <div className="prose max-w-3xl text-sm">
        <h2>Client API Webhooks</h2>
        <p>الحدث المدعوم حالياً: <code>order-status</code></p>
        <h3>Payload</h3>
        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-auto">{`{
  "event": "order-status",
  "event_id": "uuid",
  "order_id": "uuid",
  "order_uuid": "external uuid (client supplied)",
  "status": "pending|processing|completed|failed|cancelled",
  "product_id": "uuid",
  "quantity": number,
  "updated_at": "ISO timestamp"
}`}</pre>
        <h3>Headers</h3>
        <ul>
          <li><code>X-Webhook-Signature-Version</code> (v1)</li>
          <li><code>X-Webhook-Timestamp</code> (unix seconds)</li>
          <li><code>X-Webhook-Nonce</code> (uuid v4)</li>
          <li><code>X-Webhook-Signature</code> (HMAC-SHA256)</li>
        </ul>
        <h3>Signing</h3>
        <p>التوقيع يُنشأ على الشكل:<br/><code>method + "\n" + path + "\n" + timestamp + "\n" + nonce + "\n" + sha256(body)</code></p>
        <h3>Idempotency & Replay Window</h3>
        <p>القيمة <code>event_id</code> ثابتة لكل إعادة إرسال (retry/redeliver). نافذة التحقق الزمنية المقترحة: ±300 ثانية اعتماداً على <code>X-Webhook-Timestamp</code>.</p>
        <h3>Retry Policy</h3>
        <p>مواعيد المحاولات بعد الفشل: 0s, 30s, 120s, 600s, 3600s, 21600s ثم تستمر كل 21600s حتى 10 محاولات؛ بعدها تُعلَّم <code>dead</code>.</p>
        <h3>Success Criteria</h3>
        <p>أي كود HTTP من فئة 2xx يعتبر نجاحاً. غير ذلك ⇒ إعادة محاولة ضمن السياسة.</p>
        <h3>Timeouts</h3>
        <p>المهلة: 15s (تشمل الاتصال)؛ محاولات الاتصال البطيئة تتوقف بعد ~10s.</p>
        <h3>Security</h3>
        <p>لا يتم تضمين السر في أي لوج. الرجاء تخزين السر في خادمك بأمان.</p>
      </div>
    </AdminShell>
  );
}
