import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminApp from '../src/admin/AdminApp'
import type { AdminData } from '../src/admin/model'

const { getAdminData, getAdminAuthorizationUrl, getAdminSignInUrl, AdminServiceError } = vi.hoisted(() => {
  class MockAdminServiceError extends Error {
    constructor(readonly code: string) { super(code) }
  }
  return { getAdminData: vi.fn(), getAdminAuthorizationUrl: vi.fn(), getAdminSignInUrl: vi.fn(), AdminServiceError: MockAdminServiceError }
})
vi.mock('../src/admin/adminService', () => ({ getAdminData, getAdminAuthorizationUrl, getAdminSignInUrl, AdminServiceError }))

const data: AdminData = {
  invitations: [
    { invitationKey: 'key-one', primaryGuestName: 'The Ediriweera family', invitedGuestNames: ['Nimali Ediriweera', 'Ravi Ediriweera'], maxGuests: 2, active: true, createdAt: '', revokedAt: '' },
    { invitationKey: 'key-two', primaryGuestName: 'Taylor Swift', invitedGuestNames: [], maxGuests: 1, active: true, createdAt: '', revokedAt: '' },
  ],
  responses: [
    { invitationKey: 'key-one', submittedAt: '2026-10-01T12:00:00Z', updatedAt: '', attending: true, guests: [{ name: 'Nimali Ediriweera' }], dietaryRequirements: 'Vegetarian', songRequest: 'Jazz', message: 'See you there' },
  ],
  duplicateResponseCount: 0,
  orphanResponseCount: 0,
}

describe('admin console', () => {
  beforeEach(() => {
    cleanup()
    if (!HTMLDialogElement.prototype.showModal) HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    if (!HTMLDialogElement.prototype.close) HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) }
    getAdminData.mockReset().mockResolvedValue(data)
    getAdminAuthorizationUrl.mockReset().mockResolvedValue('https://script.google.com/authorize')
    getAdminSignInUrl.mockReset().mockReturnValue('https://script.google.com/macros/s/deployment/exec?admin=signin')
  })

  it('searches guests by invitation name and combines the search with RSVP and attendance filters', async () => {
    render(<AdminApp />)
    await screen.findByText('Invitation groups')
    fireEvent.click(screen.getByRole('button', { name: 'Guest management' }))
    fireEvent.change(screen.getByLabelText('Search guest or invitation'), { target: { value: 'Ediriweera' } })
    fireEvent.change(screen.getByLabelText('RSVP status'), { target: { value: 'confirmed' } })
    fireEvent.change(screen.getByLabelText('Attendance'), { target: { value: 'attending' } })
    expect(screen.getByText(/1 matching individual guests/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nimali Ediriweera' })).toBeInTheDocument()
    expect(screen.queryByText('Ravi Ediriweera')).not.toBeInTheDocument()
  })

  it('opens an invitation group and displays the stored RSVP answers read-only', async () => {
    render(<AdminApp />)
    await screen.findByText('Invitation groups')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Admin sections' })).getByRole('button', { name: 'Guest management' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nimali Ediriweera' }))
    const dialog = screen.getByRole('dialog', { name: 'The Ediriweera family' })
    expect(within(dialog).getByText('Vegetarian')).toBeInTheDocument()
    expect(within(dialog).getByText('Jazz')).toBeInTheDocument()
    expect(within(dialog).getByText('See you there')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /save|edit|delete/i })).not.toBeInTheDocument()
  })

  it('shows a fail-closed error and no fabricated metrics when authorization/data retrieval fails', async () => {
    getAdminData.mockRejectedValue(new Error('denied'))
    const { container } = render(<AdminApp />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Apps Script connected but could not return RSVP data'))
    expect(container.querySelector('.admin-metrics')).toBeNull()
  })

  it('offers a Google authorization link when the active user has not granted the required scopes', async () => {
    getAdminData.mockRejectedValue(new AdminServiceError('authorization_required'))
    render(<AdminApp />)
    const link = await screen.findByRole('link', { name: 'Authorize Google access' })
    expect(link).toHaveAttribute('href', 'https://script.google.com/authorize')
    expect(screen.getByRole('alert')).toHaveTextContent('Choose your admin Google account')
  })

  it('offers a separate Google sign-in link when the Apps Script bridge cannot start', async () => {
    getAdminData.mockRejectedValue(new AdminServiceError('connection'))
    render(<AdminApp />)
    const link = await screen.findByRole('link', { name: 'Open Google account access' })
    expect(link).toHaveAttribute('href', 'https://script.google.com/macros/s/deployment/exec?admin=signin')
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in to Google with the approved admin account')
  })
})
