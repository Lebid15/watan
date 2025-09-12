import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
  },
};

const API = __ENV.API_BASE || 'https://api.wtn4.com';
const ORIGIN = __ENV.ORIGIN || 'https://wtn4.com';
const EMAIL = __ENV.EMAIL || 'demo@example.com';
const PASSWORD = __ENV.PASSWORD || 'invalid';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Origin': ORIGIN,
  };
  const res = http.post(`${API}/api/auth/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }), { headers });
  check(res, {
    'status is 200/401': r => [200,401].includes(r.status),
    'has ACAO': r => r.headers['Access-Control-Allow-Origin'] !== undefined,
  });
  sleep(1);
}
