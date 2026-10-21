import { describe, expect, it } from 'vitest'
import { buildAdminGroups, buildAdminGuests, csvText, dashboardMetrics, type AdminData } from '../src/admin/model'

const fixture: AdminData = {
  invitations: [
    { invitationKey: 'key-household', primaryGuestName: 'The Lee family', invitedGuestNames: ['Ari Lee', 'Mina Lee'], maxGuests: 3, active: true, createdAt: '', revokedAt: '' },
    { invitationKey: 'key-single', primaryGuestName: 'Zoë O’Neil', invitedGuestNames: [], maxGuests: 1, active: true, createdAt: '', revokedAt: '' },
    { invitationKey: 'key-revoked', primaryGuestName: 'Old invite', invitedGuestNames: [], maxGuests: 1, active: false, createdAt: '', revokedAt: '' },
  ],
  responses: [
    { invitationKey: 'key-household', submittedAt: '2026-01-01', updatedAt: '', attending: true, guests: [{ name: 'Ari Lee' }, { name: 'Sam Lee' }], dietaryRequirements: 'Vegan', songRequest: '', message: '' },
    { invitationKey: 'key-single', submittedAt: '', updatedAt: '', attending: false, guests: [], dietaryRequirements: '', songRequest: '', message: '' },
    { invitationKey: 'key-revoked', submittedAt: '', updatedAt: '', attending: true, guests: [{ name: 'Old invite' }], dietaryRequirements: '', songRequest: '', message: '' },
  ],
  duplicateResponseCount: 0,
  orphanResponseCount: 0,
}

describe('admin reporting model', () => {
  it('counts groups separately from named individuals and handles partial attendance', () => {
    const groups = buildAdminGroups(fixture)
    const guests = buildAdminGuests(groups)
    expect(dashboardMetrics(groups, guests)).toMatchObject({ invitationGroups: 2, individualGuests: 3, respondedGroups: 2, pendingGroups: 0, attending: 2, declined: 2, responseRate: 1, attendanceRate: 0.5 })
    expect(guests.map(({ name, attendanceStatus }) => [name, attendanceStatus])).toEqual([['Ari Lee', 'attending'], ['Mina Lee', 'declined'], ['Sam Lee', 'attending'], ['Zoë O’Neil', 'declined'], ['Old invite', 'attending']])
  })

  it('treats unrecognized response values as pending and handles empty denominators', () => {
    const groups = buildAdminGroups({ ...fixture, invitations: [fixture.invitations[0]], responses: [{ ...fixture.responses[0], attending: null }] })
    expect(groups[0].responseStatus).toBe('unknown')
    expect(dashboardMetrics(groups, buildAdminGuests(groups))).toMatchObject({ respondedGroups: 0, pendingGroups: 1, responseRate: 0, attendanceRate: null, unknownResponses: 1 })
    expect(dashboardMetrics([], [])).toMatchObject({ responseRate: null, attendanceRate: null, pendingGroups: 0 })
  })

  it('does not treat an accepting response without attendee names as a valid reply', () => {
    const groups = buildAdminGroups({ ...fixture, invitations: [fixture.invitations[0]], responses: [{ ...fixture.responses[0], guests: [] }] })
    expect(groups[0].responseStatus).toBe('unknown')
    expect(dashboardMetrics(groups, buildAdminGuests(groups))).toMatchObject({ respondedGroups: 0, pendingGroups: 1, attending: 0, declined: 0 })
  })

  it('uses the first stored response when duplicate rows share a token', () => {
    const duplicate = { ...fixture.responses[0], attending: false }
    expect(buildAdminGroups({ ...fixture, responses: [fixture.responses[0], duplicate] })[0].responseStatus).toBe('confirmed')
  })

  it('quotes CSV fields, preserves Unicode, and neutralizes formula prefixes', () => {
    const csv = csvText(['Name', 'Answer'], [['Zoë', 'needs, "care"\nand =2+2'], ['Ari', '  @SUM(A1:A2)']])
    expect(csv).toContain('"Zoë","needs, ""care""\nand =2+2"')
    expect(csv).toContain("'  @SUM(A1:A2)")
    expect(csv).toMatch(/^\uFEFF"Name","Answer"\r\n/)
  })
})
