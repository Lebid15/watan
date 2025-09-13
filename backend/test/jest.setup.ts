// Global Jest test setup
// Use in-memory sqlite for faster isolated e2e tests when real Postgres not available.
process.env.TEST_DB_SQLITE = process.env.TEST_DB_SQLITE || 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PRICE_DECIMALS = process.env.PRICE_DECIMALS || '2';
process.env.PASSKEYS_ENABLED = process.env.PASSKEYS_ENABLED || 'false';
process.env.TEST_DISABLE_SCHEDULERS = process.env.TEST_DISABLE_SCHEDULERS || 'true';
process.env.TEST_SYNC_CLIENT_API_LOGS = process.env.TEST_SYNC_CLIENT_API_LOGS || '1';
process.env.TEST_DISABLE_RATE_LIMIT = process.env.TEST_DISABLE_RATE_LIMIT || 'false';
// Suppress noisy order creation logs unless explicitly enabled
process.env.TEST_VERBOSE_ORDERS = process.env.TEST_VERBOSE_ORDERS || 'false';

// Increase default timeout for slower module/bootstrap operations.
jest.setTimeout(20000);

// Global timer collector to help prevent open handle leaks
const _setInterval = global.setInterval.bind(global);
const _setTimeout = global.setTimeout.bind(global);
const __timers: any[] = [];
global.setInterval = ((...args: any[]) => { const id = _setInterval.apply(global, args as any); __timers.push(id); return id; }) as any;
global.setTimeout = ((...args: any[]) => { const id = _setTimeout.apply(global, args as any); __timers.push(id); return id; }) as any;
afterAll(() => { for (const id of __timers) { try { clearInterval(id as any); clearTimeout(id as any); } catch {} } });

// Quiet console.log output by default (retain warnings/errors) while allowing opt-in verbosity
// Skips suppression if TEST_VERBOSE_ORDERS=true so developers can debug order flows.
(() => {
	const verbose = process.env.TEST_VERBOSE_ORDERS === 'true';
	if (verbose) return; // keep original console
	const origLog = console.log.bind(console);
	const allowPrefixes = new Set([
		'[TEST]', // explicit test logs
	]);
	console.log = (...args: any[]) => {
		try {
			if (args.length && typeof args[0] === 'string') {
				const first: string = args[0];
				// Allow explicit test tagged messages
				for (const p of allowPrefixes) { if (first.startsWith(p)) return origLog(...args); }
				// Drop noisy default logs
				return; 
			}
		} catch {}
	};
})();
