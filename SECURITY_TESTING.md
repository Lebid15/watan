# Security & Hardening Playbook

This document defines the minimum recurring security checks to run before distributing a build to any merchant.

## 1. Scope
In scope:
- Backend (NestJS) API (all paths under /api)
- Frontend (Next.js) tenant stores (all non-api subdomains)
- Nginx edge config (CORS, maintenance, multi-tenant headers)
- Container images (frontend, backend, nginx)
- Database migrations / multi-tenant isolation logic

Out of scope (initial phase): billing provider external systems, email/SMS vendors.

## 2. Quick Run Order (Fast 15–20 min)
1. Dependency scan (npm & OS packages)
2. Static code grep for obvious auth / tenant bypass smells
3. Secrets leak scan
4. OWASP ZAP baseline (unauth + auth) against staging
5. Multi-tenant cross-access manual probe (X-Tenant-Host swap)
6. High‑risk endpoints auth check (/api/admin, /api/dev/*)

## 3. Tooling
| Category | Tool | Command (reference) |
|----------|------|----------------------|
| Dependency (JS) | npm audit | Automated in pipeline |
| Dependency (Images) | trivy image | trivy image watan-backend:latest |
| Static App (SAST) | semgrep | semgrep --config auto |
| Secrets | gitleaks | gitleaks detect --no-git -s . |
| Dynamic (DAST) | zap-baseline | zap-baseline.py -t https://staging.wtn4.com |
| Fuzz / Discovery | ffuf | ffuf -w wordlist -u https://api.staging.wtn4.com/FUZZ |
| Load (basic) | k6 | k6 run scripts/load/login.js |

(Provide wordlists and k6 scripts under scripts/security/ later.)

## 4. Multi-Tenant Isolation Checklist
- A user from tenant A cannot access product/order/user of tenant B by ID mutation.
- X-Tenant-Host header removal leads to 400/403 (not leakage fallback).
- Changing Host (via curl --header) does not switch tenant inside same token unless token claims match.
- Maintenance mode only impacts tenant subdomains (root/api unaffected).

## 5. Authentication & Session
- JWT signature tamper => 401.
- Expired token => 401 (not 500).
- Reused WebAuthn challenge => rejected.
- Rate limiting (planned) not yet implemented: flag risk.

## 6. CORS
- Allowed Origins: *.wtn4.com only.
- Disallowed origin => no ACAO header.
- Credentials true only for allowed origin.

## 7. Critical Headers (Target State)
| Header | Value |
|--------|-------|
| Content-Security-Policy | default-src 'self' 'unsafe-inline' https: data: |
| X-Frame-Options | DENY or SAMEORIGIN |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), geolocation=(), microphone=() |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |

(Several may need to be added to nginx later.)

## 8. High-Risk Endpoints Review
- /api/dev/* restricted & not accessible with normal user role.
- /api/admin/* enforces role guard server-side (not UI only).
- /api/auth/login returns consistent CORS & does not leak stack traces.

## 9. Vulnerability Severity Handling
| Severity | Action | SLA |
|----------|--------|-----|
| Critical | Block release | Immediate |
| High | Patch before merchant delivery | <24h |
| Medium | Schedule in next sprint | <7d |
| Low | Backlog | As capacity |

## 10. Release Gate
A build may ship to a merchant only if:
- No Critical/High open
- Medium issues documented & accepted
- All checks in Section 2 passed within last 48h

## 11. Future Enhancements
- Add automated k6 smoke in CI
- Implement rate limiting on auth endpoints
- Centralized audit trail integrity hash
- CSP strict nonce based

---
Generated initial baseline; iterate per finding.
