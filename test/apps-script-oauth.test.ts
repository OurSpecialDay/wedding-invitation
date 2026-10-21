import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const invitationHeaders = ['Invitation Token', 'Primary Guest Name', 'Email', 'Invited Guest Names', 'Max Guests', 'Active', 'Created At', 'Revoked At']
const responseHeaders = ['Invitation Token', 'RSVP ID', 'Submitted At', 'Updated At', 'Attending', 'Guest Count', 'Guest Names', 'Dietary Requirements', 'Song Request', 'Message']
const token = 'a'.repeat(32)

function createAppsScript() {
  const properties = new Map<string, string>([
    ['GOOGLE_CLIENT_ID', 'client-id'],
    ['GOOGLE_CLIENT_SECRET', 'client-secret'],
    ['ADMIN_SETUP_PASSPHRASE', 'test-passphrase'],
    ['ALLOWED_PARENT_ORIGIN', 'https://example.test'],
    ['SPREADSHEET_ID', 'spreadsheet_12345678901234567890'],
    ['SPREADSHEET_NAME', 'Test wedding'],
    ['GOOGLE_REFRESH_TOKEN', 'refresh-token'],
    ['GOOGLE_ACCESS_TOKEN', 'expired-token'],
    ['GOOGLE_ACCESS_TOKEN_EXPIRES_AT', '0'],
  ])
  const invitations = [
    invitationHeaders,
    [token, 'Primary Guest', 'private@example.test', JSON.stringify(['Named Guest']), 3, true, '', ''],
  ]
  let responses: unknown[][] = [responseHeaders]
  const calls: Array<{ url: string; options: Record<string, unknown> }> = []
  const bridgeTemplates: Array<Record<string, unknown>> = []
  const signInTemplates: Array<Record<string, unknown>> = []
  const scriptCache = new Map<string, string>()
  let googleStatus = 200
  let refreshResult: Record<string, unknown> = { access_token: 'fresh-access-token', expires_in: 3600 }
  let authorizationResult: Record<string, unknown> = { access_token: 'new-access-token', refresh_token: 'new-refresh-token', expires_in: 3600 }
  let metadata = { spreadsheetId: 'spreadsheet_12345678901234567890', properties: { title: 'Test wedding' }, sheets: [{ properties: { title: 'Invitations' } }, { properties: { title: 'Responses' } }] }
  let headers = [invitationHeaders, responseHeaders]

  const context: Record<string, unknown> = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties.get(key) || null,
        setProperty: (key: string, value: string) => { properties.set(key, String(value)); return null },
        deleteProperty: (key: string) => { properties.delete(key); return null },
        getProperties: () => Object.fromEntries(properties),
      }),
    },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/test-deployment/exec' }),
      AuthMode: { FULL: 'FULL' },
      AuthorizationStatus: { NOT_REQUIRED: 'NOT_REQUIRED', REQUIRED: 'REQUIRED' },
      getAuthorizationInfo: () => ({ getAuthorizationUrl: () => 'https://script.google.com/authorize', getAuthorizationStatus: () => 'REQUIRED' }),
      getScriptId: () => 'test-script-id',
      newStateToken: () => {
        const builder = {
          withMethod: () => builder,
          withArgument: () => builder,
          withTimeout: () => builder,
          createToken: () => 'signed-state-token',
        }
        return builder
      },
    },
    Utilities: { getUuid: () => 'generated-rsvp-id' },
    LockService: {
      getScriptLock: () => ({ waitLock: () => {}, hasLock: () => true, releaseLock: () => {} }),
    },
    UrlFetchApp: {
      fetch: (url: string, options: Record<string, unknown>) => {
        calls.push({ url, options })
        const method = String(options.method || 'get').toLowerCase()
        let status = 200
        let body: Record<string, unknown> = {}
        if (url === 'https://oauth2.googleapis.com/token') {
          if ((options.payload as Record<string, unknown>)?.grant_type === 'refresh_token') {
            body = refreshResult
            status = refreshResult.error ? 400 : 200
          } else {
            body = authorizationResult
            status = authorizationResult.error ? 400 : 200
          }
        } else if (url === 'https://oauth2.googleapis.com/revoke') {
          body = {}
        } else if (url.includes('sheets.googleapis.com')) {
          if (googleStatus !== 200) {
            status = googleStatus
            body = { error: { message: 'mock API failure' } }
          } else if (url.includes('?fields=')) {
            body = metadata
          } else if (url.includes('values:batchGet')) {
            if (decodeURIComponent(url).includes('A1:H1')) body = { valueRanges: headers.map((values) => ({ values: [values] })) }
            else body = { valueRanges: [invitations, responses].map((values) => ({ values })) }
          } else if (url.includes('/values/')) {
            const rawRange = decodeURIComponent(url.split('/values/')[1].split('?')[0])
            if (rawRange.startsWith('Invitations!')) body = { values: invitations }
            else if (rawRange.startsWith('Responses!')) body = { values: responses }
          }
          if (method === 'put') {
            const payload = JSON.parse(String(options.payload)) as { values: unknown[][] }
            const rowNumber = Number(decodeURIComponent(url).match(/Responses!A(\d+):J/)?.[1] || 0)
            if (rowNumber > 0) responses[rowNumber - 1] = payload.values[0]
            body = { updatedRows: 1 }
          }
          if (method === 'post') {
            const payload = JSON.parse(String(options.payload)) as { values: unknown[][] }
            responses.push(payload.values[0])
            body = { updates: { updatedRows: 1 } }
          }
        }
        return {
          getResponseCode: () => status,
          getContentText: () => JSON.stringify(body),
        }
      },
    },
    HtmlService: {
      createHtmlOutput: (content: string) => ({ content, setTitle: function () { return this } }),
      createHtmlOutputFromFile: (file: string) => ({ file, setTitle: function () { return this } }),
      createTemplate: (content: string) => {
        const template: Record<string, unknown> = { content, evaluate: () => ({ content, setTitle: function () { return this } }) }
        signInTemplates.push(template)
        return template
      },
      createTemplateFromFile: () => {
        const template: Record<string, unknown> = { evaluate: () => ({ setXFrameOptionsMode: () => ({}) }) }
        bridgeTemplates.push(template)
        return template
      },
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
    },
    CacheService: { getScriptCache: () => ({ get: (key: string) => scriptCache.get(key) || null, put: (key: string, value: string) => { scriptCache.set(key, value) } }) },
    RsvpValidation: {
      isToken: (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{32}$/.test(value),
      validate: (_invitation: unknown, rsvp: Record<string, unknown>) => rsvp && typeof rsvp.attending === 'boolean' && Array.isArray(rsvp.guests) ? [] : ['invalid'],
    },
  }
  vm.runInNewContext(readFileSync(resolve(process.cwd(), 'scripts/google-apps-script/Code.gs'), 'utf8'), context)
  return {
    context: context as Record<string, (...args: never[]) => unknown>,
    properties,
    calls,
    bridgeTemplates,
    signInTemplates,
    setRefreshResult: (value: Record<string, unknown>) => { refreshResult = value },
    setAuthorizationResult: (value: Record<string, unknown>) => { authorizationResult = value },
    setGoogleStatus: (value: number) => { googleStatus = value },
    setMetadata: (value: typeof metadata) => { metadata = value },
    setHeaders: (value: string[][]) => { headers = value },
    getResponses: () => responses,
    setResponses: (value: unknown[][]) => { responses = value },
  }
}

describe('Apps Script OAuth and Sheets API bridge', () => {
  it('provides a top-level scope authorization link from the admin sign-in route', () => {
    const script = createAppsScript()
    script.context.doGet({ parameter: { admin: 'signin' } })
    expect(script.signInTemplates[0].authorizationUrl).toBe('https://script.google.com/authorize')
    expect(script.signInTemplates[0].authorizationStatus).toBe('REQUIRED')
    expect(String(script.signInTemplates[0].content)).toContain('Authorize Google access')
  })

  it('serves the bridge with its configured parent origin and per-load nonce', () => {
    const script = createAppsScript()
    script.context.doGet({ parameter: {
      parentOrigin: 'https://example.test', bridgeNonce: '12345678-1234-4234-8234-123456789abc',
    } })
    expect(script.bridgeTemplates[0].allowedParentOrigin).toBe('https://example.test')
    expect(script.bridgeTemplates[0].bridgeNonce).toBe('12345678-1234-4234-8234-123456789abc')
  })

  it('rejects bridge requests without a valid handshake nonce', () => {
    const script = createAppsScript()
    const result = script.context.doGet({ parameter: { parentOrigin: 'https://example.test' } }) as { content: string }
    expect(result.content).toContain('Invalid RSVP bridge request')
    expect(script.bridgeTemplates).toHaveLength(0)
  })

  it('rejects bridge requests from an unconfigured parent origin', () => {
    const script = createAppsScript()
    const result = script.context.doGet({ parameter: {
      parentOrigin: 'https://attacker.example', bridgeNonce: '12345678-1234-4234-8234-123456789abc',
    } }) as { content: string }
    expect(result.content).toContain('parent origin is not allowed')
    expect(script.bridgeTemplates).toHaveLength(0)
  })

  it('keeps the hosted admin page script syntactically valid', () => {
    const html = readFileSync(resolve(process.cwd(), 'scripts/google-apps-script/Admin.html'), 'utf8')
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
    expect(script).toBeTruthy()
    expect(() => new vm.Script(script || '')).not.toThrow()
  })

  it('rejects a callback state mismatch before exchanging the code', () => {
    const script = createAppsScript()
    script.properties.set('OAUTH_PENDING_NONCE', 'expected-nonce')
    const result = script.context.oauthCallback({ parameter: { oauthNonce: 'wrong-nonce', code: 'code', picked_file_ids: 'file_id_12345678901234567890' } }) as { content: string }
    expect(result.content).toContain('state could not be verified')
    expect(script.calls).toHaveLength(0)
  })

  it('handles OAuth denial without changing the configured connection', () => {
    const script = createAppsScript()
    script.properties.set('OAUTH_PENDING_NONCE', 'expected-nonce')
    const result = script.context.oauthCallback({ parameter: { oauthNonce: 'expected-nonce', error: 'access_denied' } }) as { content: string }
    expect(result.content).toContain('authorization was denied')
    expect(script.properties.get('GOOGLE_REFRESH_TOKEN')).toBe('refresh-token')
  })

  it('handles authorization-code exchange errors without replacing the connection', () => {
    const script = createAppsScript()
    script.properties.set('OAUTH_PENDING_NONCE', 'expected-nonce')
    script.setAuthorizationResult({ error: 'invalid_grant' })
    const result = script.context.oauthCallback({ parameter: {
      oauthNonce: 'expected-nonce', code: 'bad-code', picked_file_ids: 'spreadsheet_12345678901234567890',
    } }) as { content: string }
    expect(result.content).toContain('could not be completed')
    expect(script.properties.get('GOOGLE_REFRESH_TOKEN')).toBe('refresh-token')
  })

  it('exchanges the code, verifies the selected Sheet, then stores the connection', () => {
    const script = createAppsScript()
    script.properties.set('OAUTH_PENDING_NONCE', 'expected-nonce')
    const result = script.context.oauthCallback({ parameter: {
      oauthNonce: 'expected-nonce', code: 'authorization-code', picked_file_ids: 'spreadsheet_12345678901234567890',
    } }) as { content: string }
    expect(result.content).toContain('Connected to')
    expect(script.properties.get('GOOGLE_REFRESH_TOKEN')).toBe('new-refresh-token')
    expect(script.properties.get('SPREADSHEET_ID')).toBe('spreadsheet_12345678901234567890')
    expect(script.properties.get('SPREADSHEET_NAME')).toBe('Test wedding')
  })

  it('rejects a selected Sheet with a wrong tab/header layout without replacing the connection', () => {
    const script = createAppsScript()
    script.properties.set('OAUTH_PENDING_NONCE', 'expected-nonce')
    script.setHeaders([['Wrong'], responseHeaders])
    const result = script.context.oauthCallback({ parameter: {
      oauthNonce: 'expected-nonce', code: 'authorization-code', picked_file_ids: 'spreadsheet_12345678901234567890',
    } }) as { content: string }
    expect(result.content).toContain('headers do not match')
    expect(script.properties.get('GOOGLE_REFRESH_TOKEN')).toBe('refresh-token')
  })

  it('rejects an inaccessible selected file without replacing the saved Sheet', () => {
    const script = createAppsScript()
    script.properties.set('OAUTH_PENDING_NONCE', 'expected-nonce')
    script.setGoogleStatus(404)
    const result = script.context.oauthCallback({ parameter: {
      oauthNonce: 'expected-nonce', code: 'authorization-code', picked_file_ids: 'spreadsheet_12345678901234567890',
    } }) as { content: string }
    expect(result.content).toContain('could not be accessed')
    expect(script.properties.get('GOOGLE_REFRESH_TOKEN')).toBe('refresh-token')
    expect(script.properties.get('SPREADSHEET_ID')).toBe('spreadsheet_12345678901234567890')
  })

  it('refreshes an expired access token and stores the new expiry', () => {
    const script = createAppsScript()
    const tokenResult = script.context.googleAccessToken_()
    expect(tokenResult).toBe('fresh-access-token')
    expect(script.properties.get('GOOGLE_ACCESS_TOKEN')).toBe('fresh-access-token')
    expect(Number(script.properties.get('GOOGLE_ACCESS_TOKEN_EXPIRES_AT'))).toBeGreaterThan(Date.now())
  })

  it('clears expired authorization after an invalid refresh token response', () => {
    const script = createAppsScript()
    script.setRefreshResult({ error: 'invalid_grant' })
    expect(() => script.context.googleAccessToken_()).toThrow(/authorization expired/i)
    expect(script.properties.has('GOOGLE_REFRESH_TOKEN')).toBe(false)
  })

  it('reads invitations and appends then updates RSVP rows through Sheets API', () => {
    const script = createAppsScript()
    const invitationResult = script.context.rsvpBridgeGetInvitation(token) as { status: string; invitation: { primaryGuestName: string } }
    expect(invitationResult.status).toBe('active')
    expect(invitationResult.invitation.primaryGuestName).toBe('Primary Guest')
    expect(invitationResult.rsvp).toBeNull()
    expect(script.calls.filter(({ url }) => url.includes('sheets.googleapis.com'))).toHaveLength(3)
    script.context.rsvpBridgeGetInvitation(token)
    expect(script.calls.filter(({ url }) => url.includes('sheets.googleapis.com'))).toHaveLength(4)

    const submission = {
      attending: true,
      guests: [{ name: 'Primary Guest' }],
      dietaryRequirements: '', songRequest: '', message: '',
    }
    const inserted = script.context.rsvpBridgeSubmitRsvp(token, submission) as { status: string; rsvp: { rsvpId: string } }
    expect(inserted.status).toBe('saved')
    expect(inserted.rsvp.rsvpId).toBe('generated-rsvp-id')
    const originalSubmittedAt = inserted.rsvp && script.getResponses()[1][2]
    expect(script.getResponses()).toHaveLength(2)

    const updated = script.context.rsvpBridgeSubmitRsvp(token, { ...submission, message: 'Updated' }) as { rsvp: { rsvpId: string; message: string } }
    expect(updated.rsvp.rsvpId).toBe('generated-rsvp-id')
    expect(updated.rsvp.message).toBe('Updated')
    expect(script.getResponses()).toHaveLength(2)
    expect(script.getResponses()[1][2]).toBe(originalSubmittedAt)
    expect(script.calls.some(({ url, options }) => url.includes(':append?') && options.method === 'post')).toBe(true)
    expect(script.calls.some(({ url, options }) => decodeURIComponent(url).includes('Responses!A2:J2') && options.method === 'put')).toBe(true)
  })

  it('records the primary guest name in the sheet for declined RSVPs without changing website RSVP data', () => {
    const script = createAppsScript()
    const submission = { attending: false, guests: [], dietaryRequirements: '', songRequest: '', message: '' }
    script.context.rsvpBridgeSubmitRsvp(token, submission)

    const row = script.getResponses()[1]
    expect(row[4]).toBe(false)
    expect(row[5]).toBe(0)
    expect(JSON.parse(String(row[6]))).toEqual([{ name: 'Primary Guest' }])
    expect(script.context.rsvpBridgeGetRsvp(token).rsvp.guests).toEqual([])
  })

  it('returns generic guest submission errors when Sheets API access fails', () => {
    const script = createAppsScript()
    script.setGoogleStatus(403)
    const submission = { attending: false, guests: [], dietaryRequirements: '', songRequest: '', message: '' }
    expect(() => script.context.rsvpBridgeSubmitRsvp(token, submission)).toThrow('Unable to save RSVP.')
  })

  it('disconnects and revokes the stored authorization without modifying the Sheet', () => {
    const script = createAppsScript()
    const result = script.context.rsvpAdminDisconnect('test-passphrase') as { disconnected: boolean }
    expect(result.disconnected).toBe(true)
    expect(script.properties.has('GOOGLE_REFRESH_TOKEN')).toBe(false)
    expect(script.properties.has('SPREADSHEET_ID')).toBe(false)
    expect(script.calls.some(({ url }) => url === 'https://oauth2.googleapis.com/revoke')).toBe(true)
    expect(script.getResponses()).toHaveLength(1)
  })

  it('requires the setup passphrase for admin operations', () => {
    const script = createAppsScript()
    expect(() => script.context.rsvpAdminDisconnect('wrong')).toThrow(/authorization failed/i)
  })

  it('builds an authorization URL with only drive.file and the Apps Script usercallback URI', () => {
    const script = createAppsScript()
    const result = script.context.rsvpAdminStartConnect('test-passphrase') as { authorizationUrl: string }
    const url = new URL(result.authorizationUrl)
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file')
    expect(url.searchParams.get('redirect_uri')).toBe('https://script.google.com/macros/d/test-script-id/usercallback')
    expect(url.searchParams.get('trigger_onepick')).toBe('true')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.has('api_key')).toBe(false)
  })
})
