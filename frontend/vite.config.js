import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function normalizeSiteUrl(rawSiteUrl) {
  if (!rawSiteUrl) return ''

  try {
    const parsed = new URL(rawSiteUrl)
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '')
    return `${parsed.origin}${pathname}`
  } catch {
    return ''
  }
}

function getSocialImageUrl(siteUrl) {
  if (!siteUrl) return '/og-image.png'
  const baseUrl = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`
  return new URL('og-image.png', baseUrl).toString()
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL)

  if (mode === 'production' && !siteUrl) {
    console.warn(
      '[social-meta] VITE_SITE_URL is not set or invalid. Falling back to /og-image.png for og:image and twitter:image.',
    )
  }

  return {
    plugins: [
      react(),
      {
        name: 'inject-social-meta-image-url',
        transformIndexHtml(html) {
          return html.replace(/__SOCIAL_IMAGE_URL__/g, getSocialImageUrl(siteUrl))
        },
      },
    ],
  }
})
