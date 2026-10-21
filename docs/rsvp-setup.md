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

Admin records are private, so create a **second web app deployment in the same Apps Script project**. Do not create another Apps Script project or replace the guest deployment.

In the Apps Script editor, choose **Deploy → New deployment**, select **Web app**, and use these settings for the new admin deployment:

- **Execute as:** `User accessing the web app`
- **Who has access:** `Anyone with a Google account`

These settings let the server check the signed-in Google account while keeping guest RSVP access anonymous on the existing deployment. Leave the guest deployment configured as **Execute as: Me** and **Who has access: Anyone**. Admin users must sign in and authorize the Apps Script scopes when prompted. The console provides a Google authorization link if the `userinfo.email` scope has not yet been granted; use the approved admin account, grant the requested scopes, return to the console, and refresh. The `userinfo.email` OAuth scope is required because Apps Script does not expose the active user's email without it; the backend also rejects a blank email. The `?admin=1` page is only for the Sheet owner's connection setup and is not the admin sign-in page. See Google's [web app execution options](https://developers.google.com/apps-script/guides/web) and [Session.getActiveUser reference](https://developers.google.com/apps-script/reference/base/session).

Apps Script deployments are separate versioned releases of the same saved project code. The admin and guest deployments each have their own URL, selected code version, and access settings. After changing the source, choose **Deploy → Manage deployments**, edit the deployment you want to update, select a new version, and deploy it. Update the guest and admin deployments separately when both need the change; updating one does not update the other. Updating an existing deployment keeps its URL and deployment settings. When updating the guest deployment, retain **Execute as: Me** and **Who has access: Anyone**. The admin page offers a separate Google account access link if its embedded bridge cannot start, which is useful when the browser has no active Google sign-in; after signing in, return to the admin page and refresh.

Set `ADMIN_ALLOWED_EMAILS` in Script Properties to a comma-separated list of the exact Google account email addresses allowed to view guest information. The server reads `Session.getActiveUser().getEmail()` for every admin request and fails closed if it is empty or is not in that list. The console distinguishes a missing Google authorization, an account outside the allowlist, a missing email identity, a bridge/deployment connection failure, and an Apps Script or Sheet read failure. Do not place this allowlist in frontend code. An admin account also needs access to the Apps Script web app; the Sheet remains accessed through the existing server-stored `drive.file` OAuth grant.

The private data operation is `rsvpAdminGetConsoleData()`. `AdminBridge.html` dispatches only that fixed data operation and the authorization-URL helper; the public RSVP bridge cannot dispatch admin operations. The data method joins records server-side and sends only SHA-256-derived opaque invitation keys, never bearer invitation tokens. It uses batched Sheets API GET calls only. The setup page's existing passphrase still only protects connection setup and is not used as admin-console authorization.

After creating the admin deployment, copy its `/exec` URL to the GitHub repository Actions variable `VITE_RSVP_ADMIN_URL`. For local development, place it in the ignored `.env.local` as `VITE_RSVP_ADMIN_URL` and restart Vite. Keep the admin deployment URL out of Git and do not replace the guest deployment URL; both URLs are configuration values rather than credentials. This repository cannot verify Google sign-in, Apps Script deployment access settings, or the live Sheet; verify the admin deployment using the user-owned setup and test data before exposing it to guests.

The dashboard treats `Active` invitations as eligible groups. Invitation counts are distinct from named individual invitees: a non-empty `Invited Guest Names` JSON list contains the RSVP participants, while an empty list uses `Primary Guest Name` as the one named invitee. An unreadable invitation guest list is not inferred from the primary greeting and is called out as a data-quality issue. `Max Guests` is capacity and does not create unnamed individuals in the invited-person count. Responded groups require an existing response row with a boolean `Attending` value and a non-empty guest list for acceptances. Guest attendance is counted from recorded RSVP guest names; for an accepting household, named invitees omitted from the accepted list are not attending. Attendance rate is attending people divided by recorded attending plus declining people. Missing denominators are displayed as unavailable. Historical RSVP revisions are not present: submissions update the row keyed by invitation token. If duplicate response rows exist, the first stored row is used to match the existing public lookup and a data-quality note is shown.

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
