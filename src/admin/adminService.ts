import type { AdminData } from './model'
import { isTrustedAppsScriptOrigin } from '../services/rsvpService'

type AdminErrorCode = 'not_configured' | 'connection' | 'invalid_code' | 'invalid_response' | 'backend'
type Envelope = { channel: 'wedding-rsvp-admin-bridge'; type: 'ready' | 'response'; nonce: string; id?: string; ok?: boolean; result?: unknown; errorCode?: AdminErrorCode }

export class AdminServiceError extends Error {
  constructor(readonly code: AdminErrorCode, readonly detail = '') {
    super(code)
    this.name = 'AdminServiceError'
  }
}

export class AdminService {
  private remoteWindow: Window | null = null
  private nonce: string | null = null
  private origin: string | null = null
  private ready: Promise<void> | null = null
  private dataRequest: Promise<AdminData> | null = null

  constructor(private readonly endpoint: string) {}

  getData(code: string): Promise<AdminData> {
    if (!this.endpoint) return Promise.reject(new AdminServiceError('not_configured'))
    if (this.dataRequest) return this.dataRequest
    this.dataRequest = this.loadData(code).finally(() => { this.dataRequest = null })
    return this.dataRequest
  }

  private async loadData(code: string): Promise<AdminData> {
    await this.connect()
    return this.request<AdminData>('getAdminData', code, isAdminData)
  }

  private request<T>(method: 'getAdminData', code: string, validate?: (value: unknown) => value is T): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = window.crypto.randomUUID()
      let timer: number
      const response = (event: MessageEvent<Envelope>) => {
        if (event.source !== this.remoteWindow || event.origin !== this.origin) return
        const message = event.data
        if (!message || message.channel !== 'wedding-rsvp-admin-bridge' || message.type !== 'response' || message.nonce !== this.nonce || message.id !== id) return
        window.clearTimeout(timer)
        window.removeEventListener('message', response)
        if (!message.ok) reject(new AdminServiceError(message.errorCode ?? 'backend'))
        else if (validate && !validate(message.result)) reject(new AdminServiceError('invalid_response', adminDataShapeProblem(message.result)))
        else resolve((validate === isAdminData ? normalizeAdminData(message.result as AdminData) : message.result) as T)
      }
      timer = window.setTimeout(() => {
        window.removeEventListener('message', response)
        reject(new AdminServiceError('connection'))
      }, 20_000)
      window.addEventListener('message', response)
      try {
        this.remoteWindow?.postMessage({ channel: 'wedding-rsvp-admin-bridge', type: 'request', nonce: this.nonce, id, method, code }, this.origin!)
      } catch {
        window.clearTimeout(timer)
        window.removeEventListener('message', response)
        reject(new AdminServiceError('connection'))
      }
    })
  }

  private connect(): Promise<void> {
    if (this.origin) return Promise.resolve()
    if (this.ready) return this.ready
    this.ready = new Promise((resolve, reject) => {
      const nonce = window.crypto.randomUUID()
      const iframe = document.createElement('iframe')
      iframe.title = 'Secure admin data connection'
      iframe.hidden = true
      const separator = this.endpoint.includes('?') ? '&' : '?'
      iframe.src = `${this.endpoint}${separator}admin=console&parentOrigin=${encodeURIComponent(window.location.origin)}&bridgeNonce=${encodeURIComponent(nonce)}`
      this.nonce = nonce
      const handleReady = (event: MessageEvent<Envelope>) => {
        if (event.data?.channel !== 'wedding-rsvp-admin-bridge' || event.data.type !== 'ready' || event.data.nonce !== nonce || !event.source || !isTrustedAppsScriptOrigin(event.origin)) return
        window.clearTimeout(timer)
        this.remoteWindow = event.source as Window
        this.origin = event.origin
        window.removeEventListener('message', handleReady)
        resolve()
      }
      const timer = window.setTimeout(() => {
        this.ready = null
        window.removeEventListener('message', handleReady)
        iframe.remove()
        reject(new AdminServiceError('connection'))
      }, 20_000)
      window.addEventListener('message', handleReady)
      document.body.appendChild(iframe)
    })
    return this.ready
  }

}

function isAdminData(value: unknown): value is AdminData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AdminData>
  return Array.isArray(candidate.invitations) && Array.isArray(candidate.responses)
    && typeof candidate.viewerEmail === 'string' && typeof candidate.duplicateResponseCount === 'number' && typeof candidate.orphanResponseCount === 'number'
    && candidate.invitations.every((row) => row && typeof row.invitationKey === 'string' && typeof row.primaryGuestName === 'string' && typeof row.active === 'boolean' && (row.maxGuests == null || typeof row.maxGuests === 'number') && (row.invitedGuestNames == null || (Array.isArray(row.invitedGuestNames) && row.invitedGuestNames.every((name) => typeof name === 'string'))))
    && candidate.responses.every((row) => row && (row.invitationKey == null || typeof row.invitationKey === 'string') && Array.isArray(row.guests) && (row.attending == null || typeof row.attending === 'boolean') && row.guests.every((guest) => guest && typeof guest.name === 'string'))
}

function normalizeAdminData(data: AdminData): AdminData {
  return {
    ...data,
    invitations: data.invitations.map((row) => ({ ...row, maxGuests: row.maxGuests ?? null, invitedGuestNames: row.invitedGuestNames ?? null })),
    responses: data.responses.map((row) => ({ ...row, invitationKey: row.invitationKey ?? null, attending: row.attending ?? null })),
  }
}

function adminDataShapeProblem(value: unknown): string {
  const kind = (item: unknown) => item === null ? 'null' : Array.isArray(item) ? 'array' : typeof item
  if (!value || typeof value !== 'object') return `Expected an object; received ${kind(value)}.`
  const candidate = value as Record<string, unknown>
  if (!Array.isArray(candidate.invitations)) return `Expected invitations to be an array; received ${kind(candidate.invitations)}.`
  if (!Array.isArray(candidate.responses)) return `Expected responses to be an array; received ${kind(candidate.responses)}.`
  if (typeof candidate.viewerEmail !== 'string') return `Expected viewerEmail to be a string; received ${kind(candidate.viewerEmail)}.`
  if (typeof candidate.duplicateResponseCount !== 'number') return `Expected duplicateResponseCount to be a number; received ${kind(candidate.duplicateResponseCount)}.`
  if (typeof candidate.orphanResponseCount !== 'number') return `Expected orphanResponseCount to be a number; received ${kind(candidate.orphanResponseCount)}.`
  const invitation = candidate.invitations.find((row) => !row || typeof row !== 'object' || typeof (row as Record<string, unknown>).invitationKey !== 'string' || typeof (row as Record<string, unknown>).primaryGuestName !== 'string' || typeof (row as Record<string, unknown>).active !== 'boolean' || ((row as Record<string, unknown>).maxGuests != null && typeof (row as Record<string, unknown>).maxGuests !== 'number') || ((row as Record<string, unknown>).invitedGuestNames != null && (!Array.isArray((row as Record<string, unknown>).invitedGuestNames) || ((row as Record<string, unknown>).invitedGuestNames as unknown[]).some((name) => typeof name !== 'string'))))
  if (invitation) {
    const row = invitation as Record<string, unknown>
    for (const key of ['invitationKey', 'primaryGuestName', 'active', 'maxGuests', 'invitedGuestNames'] as const) {
      const field = row[key]
      const valid = key === 'invitationKey' || key === 'primaryGuestName' ? typeof field === 'string'
        : key === 'active' ? typeof field === 'boolean'
          : key === 'maxGuests' ? field == null || typeof field === 'number'
            : field == null || (Array.isArray(field) && field.every((name) => typeof name === 'string'))
      if (!valid) return `Expected invitations[].${key} to have its documented type; received ${kind(field)}.`
    }
    return 'An invitation row is missing or malformed.'
  }
  const response = candidate.responses.find((row) => !row || typeof row !== 'object' || !((row as Record<string, unknown>).invitationKey == null || typeof (row as Record<string, unknown>).invitationKey === 'string') || !Array.isArray((row as Record<string, unknown>).guests) || !((row as Record<string, unknown>).attending == null || typeof (row as Record<string, unknown>).attending === 'boolean') || !((row as Record<string, unknown>).guests as unknown[]).every((guest) => guest && typeof guest === 'object' && typeof (guest as Record<string, unknown>).name === 'string'))
  if (response) {
    const row = response as Record<string, unknown>
    if (row.invitationKey != null && typeof row.invitationKey !== 'string') return `Expected responses[].invitationKey to be a string or null; received ${kind(row.invitationKey)}.`
    if (!Array.isArray(row.guests)) return `Expected responses[].guests to be an array; received ${kind(row.guests)}.`
    if (row.attending != null && typeof row.attending !== 'boolean') return `Expected responses[].attending to be a boolean or null; received ${kind(row.attending)}.`
    return 'A response row is malformed.'
  }
  return 'The response contains an unexpected field shape.'
}

const service = new AdminService(import.meta.env.VITE_RSVP_BRIDGE_URL?.trim() ?? '')
export const getAdminData = (code: string) => service.getData(code)
