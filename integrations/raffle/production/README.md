# Production raffle preparation

This is an implementation ready for account setup and staging validation, **not a live launch**. The local-only prototype remains unchanged under `../`; use a separate production database. The owner has confirmed that `alphaff.gg` is Verified in Resend and holds the API key privately. No key has been supplied to this repository/runtime. No real codes, configured draw, backend deployment or actual email delivery has been supplied or verified.

## Hosting inspected

On October 5, 2026, `https://alphaff.gg` returned `Server: GitHub.com` and an `x-github-request-id`. DNS resolved to `185.199.108.153` through `185.199.111.153`. The repository remote is `https://github.com/alphaffx/Alpha-website.git`, and `CNAME` is `alphaff.gg`. This confirms the live static site is served by GitHub Pages. README records publication from `main` at the repository root; the anonymous Pages configuration endpoint returned 404, so those branch settings were not independently verified. The connected Sites account returned no existing sites. No backend account was found during that inspection. The owner subsequently confirmed their Resend account and domain verification.

Keep the static website on GitHub Pages. Run the API and mail worker on **one persistent Node 24 host**, with a private local disk for SQLite. A portable Dockerfile is included; it copies only backend source, runs as the non-root Node user, and starts with entry/email delivery disabled. Docker is unavailable in this workspace, so the container image has not been built here. Node execution and behavior have been tested directly.

Render is an optional hosting candidate, not a user-approved provider selection. Its [persistent disks](https://render.com/docs/disks) require a paid service. No service was provisioned and no cost was incurred. Do not use an ephemeral filesystem, multiple API replicas, independent worker services with different disks, or a network-mounted SQLite file. For multi-host scaling, first migrate storage and locking to a managed database.

For Render: select repository `alphaffx/Alpha-website`, branch `codex/redeem-codes-raffle`, Docker runtime, leave Root Directory blank, set Dockerfile Path to `integrations/raffle/production/Dockerfile`, and Docker Build Context to `.`. Keep automatic deployment disabled until private environment variables and a persistent disk are configured. The repository root is required because the Dockerfile COPY paths are repository-relative.

## Email integration prepared

`mail.cjs` implements the [Resend sending API](https://resend.com/docs/api-reference/emails/send-email), provider idempotency keys, leased queue jobs, bounded retries, and [delivery-status lookup](https://resend.com/docs/api-reference/emails/retrieve-email). This adapter is a proposed option and has only been tested with mocked network responses. The owner subsequently confirmed domain verification in Resend; runtime credentials and actual delivery still need configuration/testing.

The proposed sender is **admin@alphaff.gg**, matching the existing website contact/FormSubmit recipient and the owner's stated preference. `env.example` records that address. The owner has now confirmed `alphaff.gg` is Verified in Resend using GoDaddy DNS. Inbox access and actual delivery have not been tested by this implementation. Keep the domain's existing inbound-mail records intact; sending-domain authentication should not silently replace its mailbox setup. No DNS changes were made by this implementation and no mailbox-delivery test has been performed.

- `disabled` (default): no provider requests and no live entry opening.
- `sandbox`: sends only to exact addresses in `RAFFLE_TEST_RECIPIENTS`; other queued recipients stop for review. It does not substitute a test recipient into a visitor's private winner message.
- `live`: sending requires credentials plus the configured verified sender. Opening entry additionally requires `RAFFLE_LIVE_ENABLED=true` and the explicit `open` command.

API acceptance is recorded as `accepted`, not delivery. The worker polls up to 100 messages per cycle for seven days after creation, rotates through checked messages, and records delivery, bounce, complaint, or failure. Bounce/complaint recipients are suppressed from future queueing; already pending jobs are held for review. After seven days, use provider logs for later delivery changes. Mail in `review` needs operator investigation; do not blindly resend, redraw, or reassign its code. No automatic override command is provided.

[Resend idempotency keys last 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys). This worker stops automatic retries after 23 hours from its first attempt, including after a process crash. A stable UUID and frozen encrypted payload ensure retries use the same key and contents. Verification mail expires with its token. Winner assignment and queue insertion commit in the same SQLite transaction.

## Deploy closed, then authorize a smoke test

1. Select/connect a backend account and an email account. Optional setup destinations: [Render dashboard](https://dashboard.render.com/) and [Resend domains](https://resend.com/domains). The available Render and Resend plugins can inspect those accounts after connection. The owner has Resend with a verified domain and a private API key; a Render/backend account is not yet confirmed.
2. Configure a host with Node 24 or build from the repository root:

   ```sh
   docker build -f integrations/raffle/production/Dockerfile -t alpha-raffle .
   ```

   Mount persistent storage at `/data`, writable by container uid 1000. Configure TLS at the hosting edge, port 8788, `/healthz` health checks, and one instance. The start command is `node integrations/raffle/production/start.cjs`. API and sender share the same host volume. The API serves JSON only; it never serves private storage or administrative commands.
3. Use `env.example` as a configuration reference. Generate a private 32-byte hex encryption key (for example through the host's secret generator), store it in the host secret manager and preserve a separate secure backup. Supply `RAFFLE_ENCRYPTION_KEY` or `RAFFLE_ENCRYPTION_KEY_FILE`, and `RAFFLE_DB` outside the source tree. Do not put keys in chat, Git, deployment logs or website code. The same key must survive deployments and be restored with backups. Changing it makes stored data inaccessible; wrong keys are refused.
4. Leave `RAFFLE_MAIL_MODE=disabled` and `RAFFLE_LIVE_ENABLED=false` for the first deploy. There is no default draw or inventory, so `/api/raffle/status` reports no draw. No email provider secret is needed in this mode.
5. In the chosen email provider, verify the sending domain by installing the provider's actual DNS records. Obtain a server-side API key and choose the sender address. No DNS values or sender have been invented here. Resend's delivery polling requires email read access as well as send access; if using a send-only key, API acceptance works but status polling will not. Confirm domain verification in the provider before enabling delivery.
6. Once the owner explicitly authorizes a test recipient, set `RAFFLE_MAIL_MODE=sandbox`, `RAFFLE_TEST_RECIPIENTS=<authorized address>`, `RAFFLE_FROM=<verified sender>` and the private `RESEND_API_KEY` (or `_FILE`). Keep live entry disabled. From the authenticated host shell, enqueue a test without opening a draw:

   ```sh
   node integrations/raffle/production/admin.cjs smoke AUTHORIZED_TEST_EMAIL
   node integrations/raffle/production/worker.cjs
   node integrations/raffle/production/worker.cjs --delivery-status
   node integrations/raffle/production/admin.cjs status
   ```

   `start.cjs` also runs the sender loop when mail is enabled, so a queued test can send immediately on such a host. Verify actual receipt/spam placement and the provider status before relying on delivery. **No smoke email has been authorized or sent in this implementation task.**

## Configure the real draw privately

Obtain the owner's month, entry closing timestamp with timezone, game/region restrictions, reward description, redemption instructions, eligibility, privacy/retention terms and support contact. The implemented draw action is manual after entry closes; scheduled drawing is not configured. No prize-claim deadline or redraw has been added. Rules are plain text rendered safely in the page; agree on content before opening because rules and inventory lock afterwards.

Prepare a private JSON file outside the repository:

```json
{
  "closes": "REPLACE_WITH_OWNER_APPROVED_ISO_TIMESTAMP_WITH_TIMEZONE",
  "rules": "REPLACE_WITH_OWNER_APPROVED_RULES_AND_PRIVACY_DETAILS"
}
```

Using the authenticated hosting shell, run:

```sh
node integrations/raffle/production/admin.cjs configure YYYY-MM /private/draw.json
node integrations/raffle/production/admin.cjs import YYYY-MM /private/reward-codes.txt
node integrations/raffle/production/admin.cjs status
```

Upload `reward-codes.txt` through the host's authenticated file transfer/secret-file mechanism: one code per line, outside the source tree. Do not paste codes into chat, command arguments, public workflow inputs or browser JavaScript. The importer accepts 1–10000 codes of 4–128 ASCII letters/digits/hyphens; confirm the supplied game's actual code format before import. It rejects `DUMMY-`, `TEST-` and `SAMPLE-` inventory and duplicate exact codes across months. It prints only a count, never the inventory. A failed batch rolls back completely. Code values, email addresses, and mail contents are encrypted with AES-256-GCM; code/email deduplication uses keyed hashes. Local OS/hosting-shell access is the admin authorization boundary: there is no web admin endpoint or browser admin token. Restrict host users and volume permissions.

Only after staging checks, real inventory, rules, cost/provider approval and live-launch authorization:

- Set the public `raffle-api-origin` meta tag in `index.html` to the actual HTTPS API origin. It contains no credential. Until then the website cannot contact a new API. Configure `RAFFLE_SITE_ORIGIN=https://alphaff.gg`; CORS allows only this origin, with same-origin validation on writes.
- Configure `RAFFLE_MAIL_MODE=live` and `RAFFLE_LIVE_ENABLED=true`, then explicitly run `admin.cjs open YYYY-MM`. Opening is refused without a future close time, inventory and mail configuration. The other static site changes also need the usual GitHub Pages release; nothing has been pushed here.
- After the closing time, `admin.cjs draw YYYY-MM` samples verified entrants using cryptographic randomness and assigns up to the code count, once. Repeated/concurrent calls return existing results. Winners need no separate claim step. Unused inventory stays in its original draw.

## Operations and remaining launch checks

- Create consistent backups with `admin.cjs backup /private/new-backup.sqlite`. Test restoration with the original key before release. Never copy only a live SQLite main file while ignoring WAL state. Backups are encrypted for sensitive fields but still expose metadata/rules; keep them private.
- The API has persistent per-email and per-socket-address limits. It intentionally ignores untrusted forwarded-IP headers; behind a proxy clients share that socket limit. Set provider-edge per-client limits/bot protection before launch and load-test the chosen configuration. One email is not proof of one person.
- Monitor process/health failures and `admin.cjs status` queue summaries. Logs contain statuses, not email/code bodies. Provider status polling is rate-limited by the provider; failed reads are retried next cycle, not reported as delivered.
- Confirm inventory retention/deletion requirements before launch; no automatic personal-data deletion policy was guessed. Do not turn rules text into a claim that an unimplemented retention schedule is active. Complete the corresponding operational procedure when the owner chooses it.
- The new raffle copy is currently English (explicit `lang="en"`); translation into the site's other languages remains a release decision.
- The container and actual hosting configuration still need a deployment smoke check. DNS verification has been confirmed by the owner. Runtime sender acceptance, inbox delivery, backup on the chosen host, privacy/rules review and traffic/abuse checks remain unverified.

## Tests executed locally

`node test-raffle-production.cjs`: encryption and key protection, private paths, closed-by-default startup, inventory atomicity, consent/rules lock, expiry and close boundary, three concurrent draw workers, queue leasing/recovery, stable retry payload/idempotency, allowlist and disabled-send guards, provider response/status handling, backup/restore and CORS/private-route isolation. Network responses are mocked; generated fixtures contain no real rewards.

`node test-raffle.cjs`: preserved local dummy workflow and browser verification/navigation/mobile checks, plus production rules/consent rendering using mocked API responses. `node test-forms.cjs` covers the existing forms. The broader site verifier previously timed out waiting for the unrelated external 3D model viewer, so a full site-suite pass is not claimed.
