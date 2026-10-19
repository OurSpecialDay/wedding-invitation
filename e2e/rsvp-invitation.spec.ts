import { expect, test } from '@playwright/test'

const siteUrl = process.env.E2E_TEST_SITE_URL
const token = process.env.E2E_RSVP_TEST_TOKEN

test('test invitation loads its guest name and RSVP form', async ({ page }) => {
  test.setTimeout(60_000)
  expect(siteUrl, 'Set the E2E_TEST_SITE_URL Actions variable').toBeTruthy()
  expect(token, 'Set the E2E_RSVP_TEST_TOKEN Actions secret').toMatch(/^[A-Za-z0-9_-]{32}$/)

  const site = new URL(siteUrl!)
  expect(['http:', 'https:']).toContain(site.protocol)
  const basePath = site.pathname.endsWith('/') ? site.pathname : `${site.pathname}/`
  const invitationUrl = new URL(`${basePath}rsvp/${token}`, site.origin)

  await page.goto(invitationUrl.toString(), { waitUntil: 'domcontentloaded' })

  const loadErrorText = 'We couldn’t load your invitation. Please try again later.'
  const loadError = page.getByRole('alert').filter({ hasText: loadErrorText })
  const envelope = page.getByRole('button', { name: /^Open the wedding invitation for / })
  let loadOutcome = 'pending'
  let guestName: string | null = null
  await expect.poll(async () => {
    if (await loadError.isVisible()) loadOutcome = 'error'
    else if (await envelope.isVisible()) {
      const accessibleName = await envelope.getAttribute('aria-label')
      const loadedName = accessibleName?.replace(/^Open the wedding invitation for\s*/, '').trim()
      if (loadedName && loadedName !== 'Guest') {
        guestName = loadedName
        loadOutcome = 'loaded'
      }
    }
    return loadOutcome
  }, {
    message: 'The invitation should load or show its error message within 45 seconds',
    timeout: 45_000,
    intervals: [250, 500, 1_000, 2_000],
  }).not.toBe('pending')

  if (loadOutcome === 'error') {
    await expect(loadError).toHaveText(loadErrorText)
    throw new Error(`Invitation failed to load: ${loadErrorText}`)
  }

  expect(guestName).toBeTruthy()

  await envelope.click()
  const form = page.locator('form.rsvp-form')
  await expect(form).toBeVisible()
  await expect(form.locator('.rsvp-form__welcome')).toHaveText(`Dear ${guestName}`)
  await expect(form.getByRole('group', { name: 'Will you be joining us?' })).toBeVisible()
  await expect(form.getByLabel('Joyfully accepts')).toBeVisible()
  await expect(form.getByLabel('Regretfully declines')).toBeVisible()
  await expect(form.getByRole('button', { name: /Send RSVP|Update RSVP/ })).toBeVisible()
})
