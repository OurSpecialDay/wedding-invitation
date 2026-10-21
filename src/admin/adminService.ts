import type { AdminData } from './model'
import { isTrustedAppsScriptOrigin } from '../services/rsvpService'

type AdminErrorCode = 'not_configured' | 'connection' | 'authorization_required' | 'identity_unavailable' | 'authorization_unavailable' | 'not_allowed' | 'backend'
type Envelope = { channel: 'wedding-rsvp-admin-bridge'; type: 'ready' | 'response'; nonce: string; id?: string; ok?: boolean; result?: unknown; errorCode?: AdminErrorCode }
export type AdminViewerIdentity = { email: string; allowed: boolean }

export class AdminServiceError extends Error {
  constructor(readonly code: AdminErrorCode) {
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

  getData(): Promise<AdminData> {
    if (!this.endpoint) return Promise.reject(new AdminServiceError('not_configured'))
    if (this.dataRequest) return this.dataRequest
    this.dataRequest = this.loadData().finally(() => { this.dataRequest = null })
    return this.dataRequest
  }

  async getAuthorizationUrl(): Promise<string> {
    await this.connect()
    return this.request<string>('getAuthorizationUrl')
  }

  async getViewerIdentity(): Promise<AdminViewerIdentity> {
    await this.connect()
    return this.request<AdminViewerIdentity>('getViewerIdentity', isAdminViewerIdentity)
  }

  private async loadData(): Promise<AdminData> {
    await this.connect()
    return this.request<AdminData>('getAdminData', isAdminData)
  }

  private request<T>(method: 'getAdminData' | 'getAuthorizationUrl' | 'getViewerIdentity', validate?: (value: unknown) => value is T): Promise<T> {
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
        else if (validate && !validate(message.result)) reject(new AdminServiceError('backend'))
        else resolve(message.result as T)
      }
      timer = window.setTimeout(() => {
        window.removeEventListener('message', response)
        reject(new AdminServiceError('connection'))
      }, 20_000)
      window.addEventListener('message', response)
      try {
        this.remoteWindow?.postMessage({ channel: 'wedding-rsvp-admin-bridge', type: 'request', nonce: this.nonce, id, method }, this.origin!)
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
    && candidate.invitations.every((row) => row && typeof row.invitationKey === 'string' && typeof row.primaryGuestName === 'string' && typeof row.active === 'boolean' && (row.maxGuests === null || typeof row.maxGuests === 'number') && (row.invitedGuestNames === null || (Array.isArray(row.invitedGuestNames) && row.invitedGuestNames.every((name) => typeof name === 'string'))))
    && candidate.responses.every((row) => row && (row.invitationKey === null || typeof row.invitationKey === 'string') && Array.isArray(row.guests) && (row.attending === null || typeof row.attending === 'boolean') && row.guests.every((guest) => guest && typeof guest.name === 'string'))
}

function isAdminViewerIdentity(value: unknown): value is AdminViewerIdentity {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AdminViewerIdentity>
  return typeof candidate.email === 'string' && typeof candidate.allowed === 'boolean'
}

const service = new AdminService(import.meta.env.VITE_RSVP_ADMIN_URL?.trim() ?? '')
export const getAdminData = () => service.getData()
export const getAdminViewerIdentity = () => service.getViewerIdentity()
export const getAdminAuthorizationUrl = () => service.getAuthorizationUrl()
export function getAdminSignInUrl(): string {
  const endpoint = import.meta.env.VITE_RSVP_ADMIN_URL?.trim()
  if (!endpoint) return ''
  try {
    const url = new URL(endpoint)
    url.search = ''
    url.searchParams.set('admin', 'signin')
    return url.toString()
  } catch {
    return ''
  }
}
