# Branch Protection (main)

Recommended GitHub branch protection settings for `main` to safeguard Gold releases:

## Suggested Settings
- Require pull request reviews: 1+ approving review
- Dismiss stale pull request approvals when new commits are pushed
- Require status checks to pass before merging:
  - Security Baseline (workflow)
  - Golden Release (if relevant for release branches)
  - CI build & tests (backend/frontend)
- Require branches to be up to date before merging
- Require signed commits (optional but recommended)
- Include administrators (enforce for admins)
- Require conversation resolution before merging
- Lock branch deletions (Prevent deletion)

## Example gh CLI Command
(Needs a token with `repo` + admin rights.)
```bash
gh api \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  /repos/OWNER/REPO/branches/main/protection \
  -f required_status_checks.strict=true \
  -f required_pull_request_reviews.dismiss_stale_reviews=true \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -F enforce_admins=true \
  -f restrictions=null \
  -f required_status_checks.contexts[]='Security Baseline' \
  -f required_status_checks.contexts[]='CI' \
  -f required_conversation_resolution=true
```
Replace OWNER/REPO and augment contexts with your actual workflow job names.

## Workflow Naming Consistency
Ensure workflow names match contexts or use the exact job names if granular enforcement is desired.
