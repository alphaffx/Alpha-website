# Private Google Sheets waitlist — connection pending

The existing inbox signup remains active. No live sheet or webhook has been configured yet.

## Setup to finish after Google Drive is connected

1. Create/import a private Google spreadsheet called **ALPHA class waitlist**. Use one tab, `Subscribers`, with these columns in row 1:
   `Email | Signed up (UTC) | Language | Consent | Consent recorded (UTC) | Status | Notes`
   Freeze the header, add a filter, and keep the sheet's sharing restricted. Do not publish it to the web.
2. Add `Code.gs` to a Google Apps Script project owned by the account that can edit the sheet. Set the script property `SPREADSHEET_ID` to the private spreadsheet ID. Do not put the ID or Google credentials in the website.
3. Deploy the script as a web app running as the owner, accepting requests from anyone so FormSubmit can reach it. This exposes a write-only signup endpoint, not the private spreadsheet. The endpoint is public and cannot authenticate submissions as genuine email owners; the existing consent checkbox is not double opt-in. Review suspicious signups before launch mail.
4. After testing a controlled signup and confirming a row and inbox notification, add the deployment URL to the existing form: `<form id="learnForm" ... data-webhook="https://script.google.com/macros/s/DEPLOYMENT_ID/exec">`. The frontend validates the Google endpoint and sends it as FormSubmit's `_webhook` field.
5. Verify duplicate requests produce one row and an `Opted out` row stays opted out. Confirm the deployment never returns email lists or spreadsheet content. Update the signup privacy copy to explain Google Sheets storage before enabling the connection.

FormSubmit's submission receipt confirms relay acceptance, not a successful spreadsheet write. Webhook retry guarantees are not documented here. Keep inbox messages as the backup and reconcile missed rows if the Google endpoint fails or hits a quota. This is not a guaranteed-delivery subscriber platform.

## Using the list

Filter Status to `Active` before preparing launch emails. Change it to `Opted out` when someone replies asking to stop; repeated signups do not reactivate them. Notes are private and preserved. This integration does not send campaigns or automatically process opt-out replies. Never expose addresses through public sharing or a mass To/CC list.

Existing inbox signups are not automatically imported; that requires access to those messages and their consent information. Do not invent missing dates or consent.

## Verification

- `node test-waitlist-sheets.cjs`: mocked Apps Script checks for validation, duplicate handling, opt-out preservation, formula escaping, and lock cleanup.
- `node test-waitlist.cjs`: mocked browser submissions, including the optional webhook payload. Sends no real email.
- Live Google authorization, deployment permissions, actual webhook delivery, and private sharing still require verification.

References: [FormSubmit webhook](https://formsubmit.co/#:~:text=_webhook), [Google Apps Script web apps](https://developers.google.com/apps-script/guides/web), [Google LockService](https://developers.google.com/apps-script/reference/lock/lock-service).
