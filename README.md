# Wedding invitation website

React, TypeScript, and Vite single-page application for the wedding website. The site is statically hosted on GitHub Pages; personalized RSVP links open the full home page at its RSVP section, using tokenized paths without a client-side routing dependency.

## Development commands

Use Node.js 22.12+.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

The Vite base path defaults to `/wedding-invitation/`. The `coupleNamePath` feature flag in `src/config/featureFlags.ts` can switch it to a slug generated from the configured bride and groom display names. `public/404.html` restores direct RSVP links under the active base path. The deploy workflow runs the tests, builds `dist`, and deploys with GitHub Actions. Set **Repository Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

The read-only admin console is deployed at `<site-base>/admin/`. It shares the guest Apps Script web app deployment, which executes as the owner and is available to anyone. Admin data requests require the server-side `ADMIN_ACCESS_CODE` Script Property. Both guest and admin bridges use `VITE_RSVP_BRIDGE_URL`. See [the RSVP setup guide](docs/rsvp-setup.md#read-only-admin-console).

## Invitation opening music

The invitation opens behind an envelope intro on every page load. The background track is `public/music/wedding-music.mp3`; replace that file to use a different track. Its URL is resolved against Vite's configured base path for GitHub Pages. If the audio cannot load or play, the invitation remains usable and the music control stays hidden.

## Project structure

```text
src/
  components/       Homepage sections, RSVP page/form, countdown
  content/          Wedding names, schedule, venue, event instant/timezone
  lib/              Countdown and shared RSVP validation
  services/         Apps Script bridge behind the RSVP service interface
  types/            Invitation and RSVP data types
  App.tsx           Homepage and lightweight path routing
scripts/
  generate-invitations.mjs
  google-apps-script/  Apps Script web bridge and server validation
test/               Mocked UI, service-boundary, and backend validation tests
docs/rsvp-setup.md  Private sheet setup, API contract, and manual deployment guide
```

## RSVP configuration

No Apps Script URL or Google Sheet is configured. The RSVP UI shows a friendly not-open state until `VITE_RSVP_BRIDGE_URL` is set in a local, untracked `.env.local`. Never commit guest data, generated tokens, spreadsheet IDs, or deployment URLs. Review [docs/rsvp-setup.md](docs/rsvp-setup.md) before creating the private sheet and test deployment. A live iframe flow still requires manual verification against a user-created test deployment and test sheet.
