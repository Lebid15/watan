"use client";
import React, { useEffect, useState } from 'react';

interface SettingsResp {
	allowAll: boolean;
	allowIps: string[];
	webhookUrl: string | null;
	enabled: boolean;
	revoked: boolean;
	lastUsedAt: string | null;
	rateLimitPerMin?: number | null;
	webhook?: {
		enabled: boolean;
		url: string | null;
		sigVersion: string;
		hasSecret: boolean;
		lastRotatedAt: string | null;
	};
}

export default function ApiSettingsPage() {
	const [userId, setUserId] = useState<string | null>(null);
	const [settings, setSettings] = useState<SettingsResp | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [ipsText, setIpsText] = useState('');
	const [webhookUrl, setWebhookUrl] = useState('');
	const [webhookSecretOnce, setWebhookSecretOnce] = useState<string | null>(null);
	const [webhookPreview, setWebhookPreview] = useState<any | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [info, setInfo] = useState<string | null>(null);

	// Assume current user endpoint /api/me returns { user:{ id } }
	useEffect(() => {
		fetch('/api/me').then(r=>r.json()).then(d=> {
			const id = d?.user?.id; setUserId(id || null);
		});
	}, []);

	useEffect(() => { if (!userId) return; refresh(); }, [userId]);

	function refresh() {
		if (!userId) return;
		setLoading(true);
		fetch(`/api/tenant/client-api/users/${userId}/settings`).then(r=>r.json()).then((d: SettingsResp) => {
			setSettings(d);
			setIpsText((d.allowIps || []).join('\n'));
			setWebhookUrl(d.webhookUrl || d.webhook?.url || '');
		}).catch(e=> setError('Failed to load settings')).finally(()=> setLoading(false));
	}

	async function action(url: string) {
		if (!userId) return;
		setLoading(true); setError(null); setInfo(null);
		const r = await fetch(url.replace(':id', userId), { method: 'POST' });
		const d = await r.json();
		if (d?.token) setToken(d.token);
		if (r.ok) { setInfo('Done'); refresh(); } else setError('Action failed');
		setLoading(false);
	}

	async function saveSettings() {
		if (!userId) return;
		setLoading(true); setError(null); setInfo(null);
		const body: any = {
			allowAll: settings?.allowAll,
			allowIps: ipsText.split(/\n+/).map(l=>l.trim()).filter(Boolean),
			webhookUrl: webhookUrl || null,
			enabled: settings?.enabled,
		};
		if (settings?.rateLimitPerMin !== undefined) body.rateLimitPerMin = settings.rateLimitPerMin === null ? null : Number(settings.rateLimitPerMin);
		const r = await fetch(`/api/tenant/client-api/users/${userId}/settings`, { method: 'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
		if (!r.ok) setError('Failed to save'); else { setInfo('Saved'); refresh(); }
		setLoading(false);
	}

	function toggleAllowAll() { if (!settings) return; setSettings({...settings, allowAll: !settings.allowAll }); }
	function toggleEnabled() { if (!settings) return; setSettings({...settings, enabled: !settings.enabled }); }
	function updateRateLimit(v: string) {
		if (!settings) return;
		const val = v.trim() === '' ? null : Math.max(1, Math.min(10000, Number(v)));
		setSettings({...settings, rateLimitPerMin: (isNaN(Number(val)) ? null : val) as any});
	}

	async function webhookGenerate() {
		if (!userId) return; setLoading(true); setError(null); setWebhookSecretOnce(null);
		const r = await fetch(`/api/tenant/client-api/users/${userId}/webhook/secret/generate`, { method:'POST' });
		const d = await r.json(); if (r.ok && d.secret) { setWebhookSecretOnce(d.secret); refresh(); } else setError('Failed'); setLoading(false);
	}
	async function webhookRotate() {
		if (!userId) return; setLoading(true); setError(null); setWebhookSecretOnce(null);
		const r = await fetch(`/api/tenant/client-api/users/${userId}/webhook/secret/rotate`, { method:'POST' });
		const d = await r.json(); if (r.ok && d.secret) { setWebhookSecretOnce(d.secret); refresh(); } else setError('Failed'); setLoading(false);
	}
	async function webhookRevoke() {
		if (!userId) return; setLoading(true); setError(null); setWebhookSecretOnce(null);
		const r = await fetch(`/api/tenant/client-api/users/${userId}/webhook/secret/revoke`, { method:'POST' });
		if (!r.ok) setError('Failed'); else { refresh(); } setLoading(false);
	}
	async function webhookSaveSettings(enable?: boolean) {
		if (!userId) return; setLoading(true); setError(null);
		const body = { enabled: enable ?? settings?.webhook?.enabled, url: webhookUrl || null, sigVersion: settings?.webhook?.sigVersion || 'v1' };
		const r = await fetch(`/api/tenant/client-api/users/${userId}/webhook/settings`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
		if (!r.ok) setError('Failed'); else refresh(); setLoading(false);
	}
	async function webhookSignPreview() {
		if (!userId) return; setLoading(true); setError(null); setWebhookPreview(null);
		const sample = { method:'POST', path:'/client/webhooks/order-status', json:{ order_id:'123', status:'accept' } };
		const r = await fetch(`/api/tenant/client-api/users/${userId}/webhook/sign-preview`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(sample)});
		const d = await r.json(); if (r.ok && d.headers) setWebhookPreview(d); else setError('Failed'); setLoading(false);
	}

	return (
		<div className="p-4 space-y-6 max-w-3xl">
			<h1 className="text-xl font-semibold">API Settings</h1>
			{error && <div className="text-red-600 text-sm">{error}</div>}
			{info && <div className="text-green-600 text-sm">{info}</div>}
			{!settings && <div>Loading...</div>}
			{settings && (
				<>
					<section className="space-y-2">
						<div className="flex gap-4 flex-wrap items-center">
							<button disabled={loading} onClick={()=>action('/api/tenant/client-api/users/:id/generate')} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Generate</button>
							<button disabled={loading} onClick={()=>action('/api/tenant/client-api/users/:id/rotate')} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Rotate</button>
							<button disabled={loading} onClick={()=>action('/api/tenant/client-api/users/:id/revoke')} className="px-3 py-1 bg-orange-600 text-white rounded text-sm">Revoke</button>
							<button disabled={loading} onClick={()=>action('/api/tenant/client-api/users/:id/enable')} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm">Enable</button>
							<button disabled={loading} onClick={refresh} className="px-3 py-1 border rounded text-sm">Refresh</button>
						</div>
						{token && <div className="mt-2"><label className="block text-xs uppercase text-gray-500">Token (copy & store securely)</label><div className="font-mono break-all bg-gray-100 p-2 rounded text-sm">{token}</div></div>}
					</section>

						<section className="space-y-4">
						<div className="flex items-center gap-3">
							<label className="flex items-center gap-2 text-sm">
								<input type="checkbox" checked={settings.allowAll} onChange={toggleAllowAll} /> Allow All IPs
							</label>
							{settings.allowAll && <span className="text-xs text-amber-600 font-medium">Warning: token accepts requests from ANY IP (high risk). Use only for local rapid tests then disable. Prefer specifying explicit IPs or ranges (CDN egress). Rotate the token immediately if leaked.</span>}
						</div>
						{!settings.allowAll && (
							<div>
								<label className="block text-xs uppercase text-gray-500 mb-1">Allowed IPs (one per line)</label>
								<textarea value={ipsText} onChange={e=>setIpsText(e.target.value)} rows={4} className="w-full border rounded p-2 font-mono text-xs" placeholder="1.2.3.4\n5.6.7.8" />
									<div className="text-[10px] text-gray-500 mt-1">يتم تطبيع العناوين: إزالة ::ffff: وتحويل ::1 إلى 127.0.0.1. استخدم الشكل النهائي (مثال: 203.0.113.5 أو 2001:db8::1).</div>
							</div>
						)}
						<div>
							<label className="block text-xs uppercase text-gray-500 mb-1">Rate Limit / Minute (optional)</label>
							<input
								type="number"
								min={1}
								max={10000}
								value={settings.rateLimitPerMin ?? ''}
								onChange={e=>updateRateLimit(e.target.value)}
								className="w-full border rounded p-2 text-sm"
								placeholder="(empty = unlimited)"
							/>
							<div className="text-[10px] text-gray-500 mt-1">اتركه فارغًا لتعطيل الحد. القيم الكبيرة جدًا قد تؤثر على الأداء.</div>
						</div>
						<div>
							<label className="block text-xs uppercase text-gray-500 mb-1">Webhook URL</label>
							<input value={webhookUrl} onChange={e=>setWebhookUrl(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="https://example.com/webhook" />
						</div>
						<div className="flex items-center gap-3">
							<label className="flex items-center gap-2 text-sm">
								<input type="checkbox" checked={settings.enabled} onChange={toggleEnabled} /> Enabled
							</label>
						</div>
						<button disabled={loading} onClick={saveSettings} className="px-4 py-2 bg-green-600 text-white rounded text-sm">Save Settings</button>
					</section>

						<section className="space-y-3">
							<h2 className="text-sm font-semibold">Documentation & Usage</h2>
							<ul className="list-disc ml-5 text-sm space-y-1">
								<li><a className="text-blue-600 underline" href="/client/api/openapi.json" target="_blank">OpenAPI JSON (public)</a></li>
								<li><a className="text-blue-600 underline" href="/api/docs" target="_blank">Swagger UI (auth required)</a> <span className="text-[10px] text-gray-500">Use Authorize -&gt; api-token</span></li>
							</ul>
							<div className="text-xs space-y-1 text-gray-600">
								<p><strong>Authentication:</strong> Send header <code className="bg-gray-100 px-1 rounded">api-token: YOUR_API_TOKEN</code> with every request.</p>
								<p><strong>Idempotency:</strong> Provide a <code className="bg-gray-100 px-1 rounded">order_uuid</code> (UUIDv4) when creating orders to avoid accidental duplicates. Reusing the same value returns the original order with <code className="bg-gray-100 px-1 rounded">reused: true</code>.</p>
								<p><strong>Endpoints (Phase 1):</strong> <code className="bg-gray-100 px-1 rounded">/client/api/profile</code>, <code className="bg-gray-100 px-1 rounded">/client/api/products</code>, <code className="bg-gray-100 px-1 rounded">/client/api/content/:categoryId</code>, <code className="bg-gray-100 px-1 rounded">/client/api/newOrder/:productId/params</code>, <code className="bg-gray-100 px-1 rounded">/client/api/check</code>.</p>
								<p><strong>Error Format:</strong> Always <code className="bg-gray-100 px-1 rounded">{`{ code, message }`}</code> with HTTP 200 for handled errors.</p>
							</div>
						</section>

						<section className="space-y-3">
							<h2 className="text-sm font-semibold">Webhook Security</h2>
							<div className="space-y-2">
								<label className="block text-xs uppercase text-gray-500 mb-1">Webhook URL</label>
								<input value={webhookUrl} onChange={e=>setWebhookUrl(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="https://example.com/webhook" />
								<div className="flex gap-2 flex-wrap text-xs">
									{!settings.webhook?.hasSecret && <button disabled={loading} onClick={webhookGenerate} className="px-3 py-1 bg-blue-600 text-white rounded">Generate Secret</button>}
									{settings.webhook?.hasSecret && <button disabled={loading} onClick={webhookRotate} className="px-3 py-1 bg-indigo-600 text-white rounded">Rotate</button>}
									{settings.webhook?.hasSecret && <button disabled={loading} onClick={webhookRevoke} className="px-3 py-1 bg-orange-600 text-white rounded">Revoke</button>}
									<button disabled={loading} onClick={()=>webhookSaveSettings()} className="px-3 py-1 border rounded">Save URL</button>
									<button disabled={loading || !settings.webhook?.hasSecret} onClick={()=>webhookSaveSettings(!settings.webhook?.enabled)} className="px-3 py-1 bg-emerald-600 text-white rounded">{settings.webhook?.enabled? 'Disable':'Enable'}</button>
									<button disabled={loading || !settings.webhook?.hasSecret} onClick={webhookSignPreview} className="px-3 py-1 bg-gray-700 text-white rounded">Sign Preview</button>
								</div>
								{webhookSecretOnce && <div className="mt-2 text-xs"><span className="block text-gray-500 mb-1">Secret (copy now – will not be shown again)</span><div className="font-mono break-all bg-gray-100 p-2 rounded">{webhookSecretOnce}</div></div>}
								{settings.webhook?.lastRotatedAt && <div className="text-[10px] text-gray-500">Last rotated: {new Date(settings.webhook.lastRotatedAt).toLocaleString()}</div>}
								<div className="text-[10px] text-amber-600">Keep secret secure. Future webhooks will be signed with HMAC-SHA256 (v1).</div>
								{webhookPreview && <div className="mt-3 text-xs space-y-1">
									<div className="font-semibold">Preview Headers</div>
									<pre className="bg-gray-100 p-2 rounded overflow-auto text-[10px]">{JSON.stringify(webhookPreview.headers,null,2)}</pre>
									<div className="font-semibold">Canonical String</div>
									<pre className="bg-gray-100 p-2 rounded overflow-auto text-[10px]">{webhookPreview.canonical}</pre>
								</div>}
							</div>
						</section>
				</>
			)}
		</div>
	);
}
