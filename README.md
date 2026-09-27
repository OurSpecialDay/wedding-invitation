# Wedding Invitation

A small, accessible, mobile-first wedding website built with React, TypeScript, and Vite. The site is a static single-page app intended for GitHub Pages. Wedding information is intentionally left as clearly marked placeholders until details are confirmed.

## Getting started

Use Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Vite prints the local development URL in the terminal. To create and preview a production build:

```sh
npm run build
npm run preview
```

## Project structure

```text
src/
  components/  Shared page sections and navigation
  App.tsx      Single-page composition
  main.tsx     React entry point
  styles.css   Global mobile-first styles
```

The page uses ordinary anchor links to its sections, so no client-side router or server rewrite rules are needed. Vite's base path is set to `/wedding-invitation/` for this GitHub Pages project site.

## GitHub Pages deployment

The workflow in `.github/workflows/deploy.yml` builds the site and deploys the `dist` directory when changes are pushed to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## RSVP and future content

The RSVP section is only a placeholder. No submission endpoint or backend is included. The planned Google Apps Script and Google Sheet integration can be added once the form requirements and endpoint are ready. Replace placeholder copy with confirmed wedding details as they become available.
