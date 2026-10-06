# Redeem Codes: local test implementation

Production preparation now lives separately in [production/README.md](production/README.md): encrypted persistent storage, private inventory import, closed-by-default API, Resend adapter and deployment instructions. The local dummy system below remains available and is never promoted into the production database.

No real codes are needed to review this feature. Nothing here sends email or deploys a raffle. The site remains static on GitHub Pages; this backend runs only on `127.0.0.1`. A static-only visit displays an unavailable state with entry disabled. The new page is English (marked `lang="en"`) across site languages.

## Run a local preview

Requires Node.js 24 with built-in `node:sqlite`. From the repository root:

```powershell
node integrations/raffle/admin.cjs seed 2026-10
node integrations/raffle/server.cjs
```

Open `http://127.0.0.1:8787/#redeem`. Enter `player@example.test`. In a second terminal:

```powershell
node integrations/raffle/admin.cjs outbox
```

Open the verification URL from that local outbox and click **Confirm my email**. This explicit confirmation avoids a simple mail-link preview consuming the token. Links expire after 24 hours; this is a verification security limit, not a prize claim deadline. Re-entering an expired, unverified address creates a fresh link. Active requests are deduplicated and do not resend. After adding the desired test entries:

```powershell
node integrations/raffle/admin.cjs draw 2026-10
node integrations/raffle/admin.cjs outbox
```

Winner messages contain dummy codes. The outbox is a database table; it is never transmitted. Only `@example.test` addresses and `DUMMY-` inventory are accepted. There is no claim deadline, redraw, real email delivery, automatic monthly schedule, or public administration UI.

The database defaults to `$HOME/.alpha-raffle-local/raffle.sqlite`, outside the public source. Set `RAFFLE_DB` to an absolute path outside the repository to use a separate fixture. Seeding the same month twice fails atomically. The UI shows the newest seeded month. Admin commands require local OS/filesystem access; no inventory/draw/outbox endpoints exist. Do not share the database or terminal outbox output. Do not serve the repository with a general-purpose file server while storing private files inside it.

## Guarantees and testing

- SQLite `BEGIN IMMEDIATE` serializes entry, verification, inventory and draw writes across processes. Draw state, unique assignments and winner outbox records commit together. Retrying a completed draw returns its existing count without creating new messages.
- Email addresses are trimmed/lowercased, with a unique `(month,email)` constraint. Only verified entries participate. Each draw samples without replacement using cryptographic randomness, up to its available inventory. Each code and each winner assignment is unique. Unused inventory stays in its original month.
- Verification tokens contain 256 random bits, are stored hashed on the entry, expire, and are consumed once. The local outbox necessarily holds the test link. It is accessible only to the CLI. Browser history removes the token and responses carry a no-referrer policy.
- The HTTP server validates Host, requires same-origin JSON mutations, limits request size and applies a basic in-memory rate limit. Static responses use an explicit asset allowlist. These are local test protections, not a production abuse-control system.

Run `node test-raffle.cjs`. It uses a temporary database outside the repository, Microsoft Edge and the existing Playwright runtime convention. It tests duplicate normalization, verification expiry/replay, excluded unverified entrants, real-address/code rejection, inventory rollback, three simultaneous draw processes, repeat draws, unique prizes/winners, closed entries, excess/empty inventory, private-route isolation, browser entry/verification, navigation/reload, mobile overflow and unavailable-backend behavior. It generates ignored `review-raffle-desktop.png` and `review-raffle-mobile.png` screenshots.

## Before a live release

This prototype deliberately refuses live inputs. Do not deploy the dummy raffle publicly. A separate production integration/review must supply:

1. An HTTPS backend host with persistent storage, backups, restricted administrative access and secret management. GitHub Pages cannot run this Node server. Decide whether to put an API behind the same origin or configure a narrowly scoped cross-origin API.
2. A transactional email provider, verified sending domain and private API credentials. Build a durable sender with retry/idempotency and delivery/bounce tracking around the outbox. Test real inbox delivery with an explicitly authorized test recipient. FormSubmit is not a winner-delivery service.
3. Secure admin-only inventory import and production configuration that intentionally replaces the dummy-only restrictions. Real codes must never enter HTML, JavaScript, Git, public APIs, logs or public hosting storage.
4. Owner decisions: game/region eligibility and reward description, monthly entry closing/draw dates and timezone, manual versus scheduled draws, how to handle unused codes, published raffle rules, privacy/retention policy and support for email corrections. No deadline has been selected or implemented. Consider entry abuse controls before accepting public traffic; one email is not proof of one person.
5. Translations for supported site languages, production monitoring and a production security/delivery check. Confirm that the published description matches the final rules and functioning delivery behavior.
