import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminApp from '../src/admin/AdminApp'
import type { AdminData } from '../src/admin/model'

const { getAdminData, AdminServiceError } = vi.hoisted(() => {
  class MockAdminServiceError extends Error {
    constructor(readonly code: string) { super(code) }
  }
  return { getAdminData: vi.fn(), AdminServiceError: MockAdminServiceError }
})
vi.mock('../src/admin/adminService', () => ({ getAdminData, AdminServiceError }))

const data: AdminData = {
  viewerEmail: 'admin@example.test',
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
  })

  async function enterAdminCode() {
    fireEvent.change(screen.getByLabelText('Admin code'), { target: { value: 'test-code' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open admin page' }))
  }

  it('searches guests by invitation name and combines the search with RSVP and attendance filters', async () => {
    render(<AdminApp />)
    await enterAdminCode()
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
    await enterAdminCode()
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
    await enterAdminCode()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Apps Script connected but could not return RSVP data'))
    expect(container.querySelector('.admin-metrics')).toBeNull()
  })

  it('uses the entered code to request admin data and reports an invalid code', async () => {
    getAdminData.mockRejectedValue(new AdminServiceError('invalid_code'))
    render(<AdminApp />)
    await enterAdminCode()
    expect(getAdminData).toHaveBeenCalledWith('test-code')
    expect(await screen.findByRole('alert')).toHaveTextContent('That admin code is incorrect')
  })
})
