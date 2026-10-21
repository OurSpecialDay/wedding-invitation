# Instructions for coding agents

- Keep this a lightweight React + TypeScript + Vite static site for GitHub Pages.
- Use semantic HTML, accessible interactions, and mobile-first responsive CSS.
- Keep homepage sections anchor-linked. Personalized RSVP links use a small path matcher; do not add a routing library unless the project needs more complex navigation.
- Do not invent wedding details. Keep unknown information clearly marked as a placeholder.
- RSVP is explicitly implemented with the Google Apps Script bridge in `scripts/google-apps-script/`. Never connect to a live sheet or deploy Apps Script without a direct user request.
- Keep guest lists, generated tokens, spreadsheet IDs, and deployment URLs out of Git. Do not add a database or paid service. The read-only admin console may use server-verified Google account authorization; keep guest RSVP access anonymous and unchanged.
- Run `npm test` and `npm run build` after RSVP changes. Live bridge verification requires a user-owned test deployment and test sheet.
- Keep components small and understandable, and avoid dependencies without a concrete benefit.
- Run `npm run build` after application changes; use `npm run dev` for local development.
