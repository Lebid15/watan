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

### 3.1 Custom Script Wrappers
- Semgrep wrapper: `scripts/security/run_semgrep.sh`
- Secrets scan: `scripts/security/run_gitleaks.sh`
- ZAP Baseline: `scripts/security/zap_baseline.sh` (env: TARGET=https://staging.wtn4.com)
- Login smoke (k6): `scripts/security/k6-login-smoke.js`
- ffuf discovery: `scripts/security/ffuf_discovery.sh`
- Rate limit probe: `scripts/security/rate_limit_probe.sh`

All scripts produce artifacts (JSON / text) to review; integrate into CI gradually.

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

## 12. Threat Model (High-Level)
| Asset | Primary Threats (STRIDE) | Existing Controls | Planned Controls |
|-------|--------------------------|-------------------|------------------|
| Tenant Data (Products/Orders) | Tampering, Information Disclosure | Tenant ID scoping in queries, X-Tenant-Host header required | Additional Semgrep rule enforcement, DB row-level validation audits |
| Auth Tokens (JWT) | Spoofing, Replay | Signed (HS/RS), expiry | Add jti + redis blacklist for logout, rate limiting |
| Admin / Dev Endpoints | Elevation of Privilege | Role guards, path restrictions | Fine-grained permission matrix, IP allowlist (optional) |
| Maintenance Mode Bypass | Abuse / Availability | Cookie + host scoping | Signed maintenance bypass token with expiry |
| CI/CD Pipeline | Tampering | GitHub protected branches | Add dependency signing / SLSA provenance |
| Secrets in Repo | Information Disclosure | gitleaks scan | Pre-commit hook, secret rotation SOP |

## 13. Test Matrix & Cadence
| Area | Tool / Script | Frequency | Gating? |
|------|---------------|-----------|---------|
| Dependency (npm) | npm audit | On PR + Daily | Warn (fail on Critical) |
| Container Vulns | Trivy | Daily + Release | Fail on Critical/High |
| SAST | Semgrep (auto + custom) | On PR | Fail on ERROR rules |
| Secrets | gitleaks | On PR + Weekly full | Fail on findings |
| DAST (baseline) | ZAP baseline | Weekly + Pre-release | Report only (phase 1) |
| Tenant Isolation | tenant_isolation_check.sh | Pre-release | Fail if WARN present |
| Fuzz Discovery | ffuf | On demand (dispatch) | Report only |
| Load/Auth Smoke | k6 login smoke | Dispatch / Pre-release | Fail if >5% errors |
| Rate Limit Probe | rate_limit_probe.sh | Monthly | Report (until implemented) |

## 14. Reporting Template
Create `SECURITY_REPORT.md` per release with sections:
```
Release: <version>
Date: <date>

Summary:
- Pass/Fail metrics

Findings Table:
| ID | Severity | Area | Description | Status | Owner | ETA |
|----|----------|------|-------------|--------|-------|-----|

Exceptions / Accepted Risks:
- <risk id>: justification, expiry date

Artifacts:
- Trivy summary: artifacts/trivy-*.txt
- Semgrep: semgrep.sarif (uploaded)
- ZAP: zap-report.html
```

## 15. Local Execution Reference
Examples (PowerShell):
```
bash scripts/security/run_semgrep.sh
bash scripts/security/run_gitleaks.sh
TARGET=https://staging.wtn4.com bash scripts/security/zap_baseline.sh
API_BASE=https://api.wtn4.com EMAIL=demo@example.com PASSWORD=bad k6 run scripts/security/k6-login-smoke.js
BASE=https://api.wtn4.com bash scripts/security/ffuf_discovery.sh
ORIGIN=https://wtn4.com bash scripts/security/rate_limit_probe.sh
```

## 16. Hardening Roadmap (Next)
1. Implement auth endpoint rate limiting (nginx or nest middleware).
2. Enforce CSP (nonce-based) + remove unsafe-inline (currently transitional CSP added at edge for frontend; API locked down with restrictive CSP).
3. Add HSTS & evaluate preload submission.
4. Add per-tenant encryption at rest review (DB level).
5. Expand Semgrep custom rules for: missing tenant filter, raw response leak, overly broad CORS.
6. Introduce ZAP full scan (authenticated context export) in staging nightly.

## 17. Acceptance Criteria Mapping
Each Release Gate (Section 10) ties to Test Matrix green results within SLA windows; deviations require CTO sign-off recorded in report.

## 18. Recent Changes (Sep 2025)
- Added baseline security headers (HSTS, CSP, Referrer-Policy, Permissions-Policy, X-Frame-Options, X-Content-Type-Options) in Nginx HTTPS blocks.
- CSP is currently permissive for frontend ('unsafe-inline') pending migration to nonces.
- API CSP locked to default-src 'none' to minimize attack surface.
- SARIF uploads enabled for Semgrep and gitleaks to integrate with GitHub code scanning.

