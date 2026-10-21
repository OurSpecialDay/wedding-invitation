import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { wedding } from './src/content/wedding-details.ts'
import { toUrlSlug } from './src/lib/url-slug.ts'
import { isFeatureEnabled } from './src/config/featureFlags.ts'

const invitationSlug = `${toUrlSlug(wedding.couple.bride.displayName)}-and-${toUrlSlug(wedding.couple.groom.displayName)}`
const invitationBase = isFeatureEnabled('coupleNamePath') ? `/${invitationSlug}/` : '/wedding-invitation/'
const adminPathWithoutSlash = `${invitationBase}admin`

function adminTrailingSlashRedirect() {
  return {
    name: 'admin-trailing-slash-redirect',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const requestUrl = (req as unknown as { url?: string }).url ?? '/'
        const [pathname, query = ''] = requestUrl.split('?', 2)
        if (pathname !== adminPathWithoutSlash) return next()
        res.statusCode = 301
        res.setHeader('Location', `${adminPathWithoutSlash}/${query ? `?${query}` : ''}`)
        res.end()
      })
    },
    configurePreviewServer(server: import('vite').PreviewServer) {
      server.middlewares.use((req, res, next) => {
        const requestUrl = (req as unknown as { url?: string }).url ?? '/'
        const [pathname, query = ''] = requestUrl.split('?', 2)
        if (pathname !== adminPathWithoutSlash) return next()
        res.statusCode = 301
        res.setHeader('Location', `${adminPathWithoutSlash}/${query ? `?${query}` : ''}`)
        res.end()
      })
    },
  }
}

export default defineConfig({
  base: invitationBase,
  plugins: [react(), adminTrailingSlashRedirect()],
  build: { rollupOptions: { input: { main: 'index.html', admin: 'admin/index.html' } } },
})
