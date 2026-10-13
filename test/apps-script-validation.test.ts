import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const context: Record<string, unknown> = {}
vm.runInNewContext(readFileSync(resolve(process.cwd(), 'scripts/google-apps-script/Validation.gs'), 'utf8'), context)
const validation = context.RsvpValidation as { isToken(value: unknown): boolean; validate(invitation: unknown, rsvp: unknown): string[] }
const invitation = { primaryGuestName: 'Primary', invitedGuestNames: ['Household'], maxGuests: 2, active: true }
const submission = { attending: true, guests: [{ name: 'Primary' }], dietaryRequirements: '', songRequest: '', message: '' }

describe('Apps Script validation source', () => {
  it('keeps the Apps Script server source syntactically valid', () => {
    expect(() => new vm.Script(readFileSync(resolve(process.cwd(), 'scripts/google-apps-script/Code.gs'), 'utf8'))).not.toThrow()
  })
  it('validates token format and invitation active state', () => {
    expect(validation.isToken('a'.repeat(32))).toBe(true)
    expect(validation.isToken('short')).toBe(false)
    expect(validation.validate({ ...invitation, active: false }, submission)).toContain('invitation')
  })
  it('enforces guest counts and text-length bounds', () => {
    expect(validation.validate(invitation, submission)).toEqual([])
    expect(validation.validate({ ...invitation, invitedGuestNames: ['One', 'Two'], maxGuests: 1 }, submission)).toContain('invitationLimit')
    expect(validation.validate(invitation, { ...submission, guests: [{ name: 'Primary' }, { name: 'Extra' }, { name: 'Another' }] })).toContain('guests')
    expect(validation.validate(invitation, { ...submission, songRequest: 'x'.repeat(121) })).toContain('songRequest')
    expect(validation.validate(invitation, { ...submission, dietaryRequirements: 'x'.repeat(501) })).toContain('dietaryRequirements')
    expect(validation.validate(invitation, { ...submission, message: 'x'.repeat(1001) })).toContain('message')
    expect(validation.validate(invitation, { ...submission, guests: [{ name: 'Primary' }, { name: 'New' }] })).toContain('extraGuests')
  })

  it('accepts a single selected invitee from a four-person list, including sheet whitespace', () => {
    const fourInvitees = {
      primaryGuestName: 'Primary',
      invitedGuestNames: ['First Guest', 'Second Guest', ' Third Guest ', 'Fourth Guest'],
      maxGuests: 4,
      active: true,
    }
    expect(validation.validate(fourInvitees, {
      ...submission,
      guests: [{ name: 'Third Guest' }],
    })).toEqual([])
  })
})
