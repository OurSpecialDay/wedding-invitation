# RSVP service setup (manual, after review)

The React application is disconnected until `VITE_RSVP_BRIDGE_URL` is provided in an untracked `.env.local`. No spreadsheet ID, Apps Script deployment URL, guest list, or token is stored in this repository.

## Invitation links and private data

Create a private JSON file outside version control with this shape:

```json
[
  { "primaryGuestName": "Guest name", "invitedGuestNames": ["Named household guest"], "email": "private@example.com", "maxGuests": 3 }
]
```

Run `node scripts/generate-invitations.mjs private-invitations.json invitation-import.csv`. The script generates 24 cryptographically random bytes per row and encodes each as 32 URL-safe characters. It writes import-ready CSV with restrictive local permissions. Do not commit the input, CSV, exported sheet, or tokens. The email is private to the `Invitations` sheet and is never returned to the browser. With the couple-name path feature disabled, each link is `<site-origin>/wedding-invitation/rsvp/<token>`.

These links are bearer credentials: anyone who receives or forwards a link can view and change that invitation’s reply. There is no identity verification, account, or email collection in the guest form. Keep the guest sheet private and revoke links by setting `Active` false.

## Google Sheet

Create a private spreadsheet with two tabs and these exact header rows:

`Invitations`: `Invitation Token`, `Primary Guest Name`, `Email`, `Invited Guest Names`, `Max Guests`, `Active`, `Created At`, `Revoked At`.

`Responses`: `Invitation Token`, `RSVP ID`, `Submitted At`, `Updated At`, `Attending`, `Guest Count`, `Guest Names`, `Dietary Requirements`, `Song Request`, `Message`.

Store `Invited Guest Names` and `Guest Names` as JSON arrays in cells (for example `["Alex"]`). Keep the sheet restricted to the couple and trusted administrators. `maxGuests` counts everyone including the primary invitee. The named guest list must fit within this number; remaining seats are unnamed guest slots.

## Google Cloud OAuth setup

The Apps Script accesses the Sheet using the wedding administrator's OAuth grant. The Apps Script deployer does not need Drive permission to the Sheet.

**Trust boundary:** The refresh token must be stored server-side for anonymous guest requests to work. The Google account that owns or can edit the Apps Script project can also read Script Properties or change the code, and therefore could use that token to access the selected file through the API. This setup removes Account A's ordinary Drive sharing permission; it cannot make Account A technically unable to access data while Account A controls the Apps Script project. If that stronger separation is required, the Apps Script owner must not control the component that stores the OAuth token.

1. Create or select a Google Cloud project, then enable the **Google Sheets API**.
2. Configure the OAuth consent screen and create an OAuth client with application type **Web application**.
3. Link the Apps Script project to this standard Google Cloud project from Apps Script **Project Settings → Google Cloud Platform (GCP) Project**. The OAuth client and enabled Sheets API must belong to that linked project.
4. In Apps Script, open **Project Settings** and copy the script ID. Register this exact redirect URI in the OAuth client:

   `https://script.google.com/macros/d/<SCRIPT_ID>/usercallback`

5. Request only `https://www.googleapis.com/auth/drive.file`. The setup flow uses Google's OAuth-triggered Picker, which returns the selected file ID with the callback. It does not browse or search the administrator's Drive.
6. Do not create an API key for this flow. The OAuth access token authorizes the Sheets API requests. The non-sensitive `drive.file` scope avoids sensitive/restricted-scope verification; follow any current Google consent-screen or app-branding requirements shown for the Cloud project. While the consent screen is in **Testing**, add the administrator as a test user and expect Google's testing-mode refresh-token lifetime limits. Publish the consent screen as needed for continued use.

## Apps Script installation and deployment

Source is in `scripts/google-apps-script/`. Copy `Code.gs`, `Validation.gs`, `Bridge.html`, `AdminBridge.html`, `Admin.html`, and `appsscript.json` into the existing standalone Apps Script project. Keep this as the existing project; do not create another deployment service.

In **Project Settings → Script Properties**, configure:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the OAuth client. Keep the secret server-side.
- `ADMIN_SETUP_PASSPHRASE` as a long, randomly generated passphrase. Anyone with it can replace or disconnect the RSVP Sheet connection.
- `ALLOWED_PARENT_ORIGIN` as the exact published site origin (scheme and host only; no path or trailing slash). For a GitHub Pages project site, this is `https://<OWNER>.github.io`, not the `/wedding-invitation` path.

Do not set `SPREADSHEET_ID` manually. The OAuth callback stores it only after the administrator selects a Google Sheet and the application verifies the required tabs and headers. The callback also stores the Sheet name and refresh token in Script Properties.

Deploy the web app from the existing project with **Execute as: Me** (the Apps Script deployer) and **Who has access: Anyone** so guests can use the bridge without signing in. The deployer authorizes the script's external-request and state-token scopes, but is not granted access to the RSVP Sheet. Update the existing deployment after code changes.

Set the admin passphrase in Script Properties before opening:

`<Apps Script /exec URL>?admin=1`

Enter the passphrase, choose **Connect Google Sheet**, sign in as the account that owns the Sheet, approve the `drive.file` permission, and select the RSVP spreadsheet. The callback confirms the exact tabs and headers before replacing any existing configuration. The status button checks that the stored authorization still works. Disconnect revokes the grant where possible and clears the token and spreadsheet properties; it does not edit the Sheet. If Google does not confirm revocation, remove the app from the administrator's Google Account security settings.

For local development, put the Apps Script `/exec` URL in the untracked `.env.local` as `VITE_RSVP_BRIDGE_URL`. For GitHub Pages, open **Repository → Settings → Secrets and variables → Actions → Variables**, create a repository variable named `VITE_RSVP_BRIDGE_URL`, and set its value to that same `/exec` URL. The deployment workflow passes this variable into `npm run build`; Vite embeds it in the public site bundle, so it is a URL, not a secret. Do not commit `.env.local` or the production deployment URL.

The Apps Script web app wraps its HTML output in a Google-hosted frame. The bridge therefore messages the page's top-level window and binds each handshake to a random per-load nonce; the guest page replies to the actual nested bridge frame. `ALLOWALL` enables framing, so the exact parent-origin check in `Bridge.html` and the guest page's Apps Script-origin check are required. After changing `Code.gs` or `Bridge.html`, save both files and update the existing Apps Script deployment with a new version. The parent also validates the nested frame's origin and nonce. The server locks response upserts by invitation token; updates preserve the original submission ID/time. Validation is performed in browser and again on the server. No invitation email or OAuth token is sent to the guest client.

## API contract

The bridge supports `getInvitation({token})`, `getRsvp({token})`, and `submitRsvp({token, rsvp})`.

- Invitation lookup returns `active` with only primary name, named guest names, and max guests; `not-found` or `revoked` contains no invitation data.
- RSVP lookup returns `active` with a response or `null`; revoked and unknown invitations remain distinct.
- Submit returns `saved` with the stored response or an invitation state. Declines are stored as `attending: false` and an empty guest array. Acceptances require at least one named attendee.
- Name, dietary, song, and message limits are 100, 500, 120, and 1,000 characters. An invitation allows at most 20 total guests.

## Read-only admin console

The static admin app is served from `<site-base>/admin/`. It reads the existing `Invitations!A:H` and `Responses!A:J` ranges in one batch and does not write to the Sheet. It never requests or returns invitation email addresses or invitation tokens. The public `Bridge.html` dispatcher remains limited to the existing guest operations.

The admin page uses a simple code prompt. Set `ADMIN_ACCESS_CODE` in Apps Script Script Properties to a private code, then enter that same code on the admin page. Apps Script checks the code before each admin data read; the code is not embedded in the site. Keep the guest deployment configured as **Execute as: Me** and **Who has access: Anyone**. The code gate is a basic interim access check, so keep the code private and rotate it if it is shared beyond the intended administrators.

Use one Apps Script web app deployment for both guest and admin bridges, configured as **Execute as: Me** and **Who has access: Anyone**. Set `VITE_RSVP_BRIDGE_URL` to its `/exec` URL in GitHub Actions repository variables and in the ignored `.env.local` for local development. Both parts of the site use this URL; the admin data call still checks `ADMIN_ACCESS_CODE` server-side.

If the admin page reports that its connection could not start, check that `ALLOWED_PARENT_ORIGIN` exactly matches the site origin shown in the browser address bar (scheme and hostname only, with no path or trailing slash), that the page uses the same deployed `/exec` URL, and that the deployment's latest version includes `AdminBridge.html` and the `admin=console` route. For GitHub Pages project sites the origin is `https://<OWNER>.github.io`, not the project path. The `/exec` deployment must allow anonymous access so its hidden bridge iframe can load without a Google sign-in redirect.

The Sheet connection continues to use the existing server-side OAuth `drive.file` refresh-token setup described above. The admin page does not add Google account authorization or any additional OAuth scope. After editing Apps Script source, update the relevant deployment to a new version. This repository cannot verify a live Sheet or deployment; use a user-owned test deployment and test Sheet for live verification.

The dashboard is read-only. Invitation and response data are joined server-side, and the admin payload uses SHA-256-derived opaque invitation keys instead of bearer tokens. The dashboard treats `Active` invitations as eligible groups. Invitation counts are distinct from named individual invitees: a non-empty `Invited Guest Names` JSON list contains the RSVP participants, while an empty list uses `Primary Guest Name` as the one named invitee. The dashboard shows data-quality notes for unreadable lists, duplicate response rows, and unmatched responses.

Guest-facing messages are generic and do not display technical errors. The Apps Script does not log guest data.

## Scheduled RSVP availability check

The `Daily RSVP invitation check` GitHub Actions workflow opens the test deployment once per day at 08:00 UTC and can also be run manually. It checks that the test invitation's guest name and RSVP form load; it does not submit an RSVP. Configure the repository Actions variable `E2E_TEST_SITE_URL` with the test site's base URL (including its project path, for example `https://<OWNER>.github.io/wedding-invitation/`) and the Actions secret `E2E_RSVP_TEST_TOKEN` with a 32-character test invitation token. Use a token from the separate test Sheet and test bridge, never a production guest invitation. The deployed test site must be built with its test bridge URL in `VITE_RSVP_BRIDGE_URL`.

For local runs, create `.env.e2e.local` in the repository root with these entries, replacing the placeholders with the test deployment values:

```dotenv
E2E_TEST_SITE_URL=https://<OWNER>.github.io/wedding-invitation/
E2E_RSVP_TEST_TOKEN=<32-character-test-token>
```

Playwright loads this file automatically when it exists. The existing `*.local` rule in `.gitignore` keeps it out of Git. Shell environment variables already set for the same keys take precedence. Run `npx playwright install chromium` once to install the local browser, then use `npm run test:e2e` to run the check. Keep a test invitation token in this file; do not use a production guest token.

### Send failure-only notifications to an admin email

GitHub sends scheduled workflow notifications to the GitHub account that created the scheduled workflow. If another account updates the `schedule` cron entry, future notifications go to that account instead. To direct these notifications to a specific admin, have that admin's GitHub account create or update the cron schedule in `.github/workflows/rsvp-e2e.yml`. The admin account must also watch this repository.

1. Sign in to the GitHub account for the admin who should receive alerts and open [Notification settings](https://github.com/settings/notifications).
2. Under **System → Actions**, choose **Only notify for failed workflows**, then choose **Email** as the delivery method and save. GitHub's [Actions notification guide](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications) describes this setting.
3. In **Repository → Watch**, ensure that account is watching the repository.
4. In **Settings → Emails**, confirm the intended admin email is added and verified, and is the address used for GitHub notifications.
5. Ensure the admin account creates or updates the `schedule` entry in `.github/workflows/rsvp-e2e.yml` and saves the change. GitHub routes scheduled workflow notifications to the user who created or last updated that cron entry; see [workflow notification behavior](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs).

This uses GitHub's built-in email notifications and does not require a notification step or email credential in the workflow. GitHub's workflow notification setting is account-level; the workflow file cannot select an arbitrary recipient email address.

## Manual verification after setup

Use a separate test spreadsheet and test deployment, never the live guest sheet. Share the test Sheet only with Account B, and confirm the Apps Script deployer Account A has no normal Drive access. Connect from the admin page and verify the selected spreadsheet name, tab/header checks, and rejected selection of an unauthorized file. Then verify acceptance, partial household attendance, an unnamed guest, decline, response update, revoked and unknown links, access-token refresh, disconnect/reconnect, and a deliberately failed API request. Check on a phone-sized viewport and confirm guest errors stay generic. This repository cannot perform the live two-account OAuth flow without a user-owned Cloud OAuth client and test deployment.
