import { useMemo, useState, type FormEvent } from 'react'
import { validateRsvpSubmission, RSVP_LIMITS } from '../lib/rsvp-validation'
import type { PublicInvitation, RsvpRecord, RsvpService, RsvpSubmission } from '../types/rsvp'
import { isFeatureEnabled } from '../config/featureFlags'

type Attendance = '' | 'yes' | 'no'
type FormValues = { attendance: Attendance; guests: string[]; dietaryRequirements: string; songRequest: string; message: string }
const emptyValues: FormValues = { attendance: '', guests: [], dietaryRequirements: '', songRequest: '', message: '' }

function ordinal(value: number) {
  const remainder = value % 100
  if (remainder >= 11 && remainder <= 13) return `${value}th`
  switch (value % 10) {
    case 1: return `${value}st`
    case 2: return `${value}nd`
    case 3: return `${value}rd`
    default: return `${value}th`
  }
}

export function RsvpForm({ token, invitation, existing, service }: { token: string; invitation: PublicInvitation; existing: RsvpRecord | null; service: RsvpService }) {
  const initialValues = useMemo<FormValues>(() => existing ? {
    attendance: existing.attending ? 'yes' : 'no', guests: existing.guests
      .map((guest) => guest.name)
      // Older replies may have stored a household salutation as an attendee.
      .filter((name) => !invitation.invitedGuestNames.length
        || invitation.invitedGuestNames.some((invitee) => invitee.trim().toLowerCase() === name.trim().toLowerCase())
        || name.trim().toLowerCase() !== invitation.primaryGuestName.trim().toLowerCase()),
    dietaryRequirements: existing.dietaryRequirements, songRequest: existing.songRequest, message: existing.message,
  } : emptyValues, [existing])
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'success' | 'failure' | null>(null)
  // A non-empty invited guest list contains the actual RSVP participants. The
  // primary name can then be a household salutation used only for the greeting.
  const namedGuests = invitation.invitedGuestNames.length
    ? invitation.invitedGuestNames
    : [invitation.primaryGuestName]
  const extraSlots = Math.max(0, invitation.maxGuests - namedGuests.length)
  const showAttendeeSelection = invitation.maxGuests > 1 && invitation.invitedGuestNames.length > 0
  const extraGuestNames = values.guests.filter((name) => !namedGuests.includes(name))
  const attendingNames = new Set(values.guests.map((name) => name.trim().toLowerCase()))

  function setGuest(name: string, checked: boolean) {
    setValues((current) => ({ ...current, guests: checked ? [...current.guests, name] : current.guests.filter((guest) => guest !== name) }))
  }

  function renderAdditionalGuestFields() {
    return Array.from({ length: extraSlots }, (_, slot) => {
      const name = extraGuestNames[slot] ?? ''
      return <label className="field" key={slot}>{ordinal(namedGuests.length + slot + 1)} invitee
        <input type="text" maxLength={RSVP_LIMITS.guestName} value={name} onChange={(event) => {
          const extras = [...extraGuestNames]
          extras[slot] = event.target.value
          setValues((current) => ({ ...current, guests: [...current.guests.filter((guest) => namedGuests.includes(guest)), ...extras] }))
        }} placeholder="Guest name" />
      </label>
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setResult(null)
    const submission: RsvpSubmission = {
      attending: values.attendance === 'yes',
      guests: values.attendance === 'yes'
        ? (!showAttendeeSelection && namedGuests.length === 1
          ? [namedGuests[0], ...extraGuestNames]
          : values.guests).filter((name) => name.trim()).map((name) => ({ name: name.trim() }))
        : [],
      dietaryRequirements: values.dietaryRequirements.trim(), songRequest: values.songRequest.trim(), message: values.message.trim(),
      honeypot: new FormData(event.currentTarget).get('website')?.toString() ?? '',
    }
    const nextErrors = values.attendance ? validateRsvpSubmission(token, invitation, submission) : { attendance: 'Please choose whether you can attend.' }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSubmitting(true)
    void service.submitRsvp(token, submission).then((saved) => {
      if (saved.status === 'saved') { setValues((current) => ({ ...current, attendance: current.attendance })); setResult('success') }
      else setResult('failure')
    }).catch(() => setResult('failure')).finally(() => setSubmitting(false))
  }

  return <form className="rsvp-form" onSubmit={handleSubmit} noValidate>
    <p className="rsvp-form__welcome">Dear {invitation.primaryGuestName}</p>
    {existing && <p className="rsvp-form__note">We have your reply. You can update it below.</p>}
    <fieldset><legend>Will you be joining us?</legend>
      <label className="choice"><input type="radio" name="attendance" value="yes" checked={values.attendance === 'yes'} onChange={() => setValues((v) => ({ ...v, attendance: 'yes' }))} /> Joyfully accepts</label>
      <label className="choice"><input type="radio" name="attendance" value="no" checked={values.attendance === 'no'} onChange={() => setValues((v) => ({ ...v, attendance: 'no', guests: [] }))} /> Regretfully declines</label>
      {errors.attendance && <p className="field-error" role="alert">{errors.attendance}</p>}
    </fieldset>
    {values.attendance === 'yes' && showAttendeeSelection && <fieldset><legend>Who will attend?</legend>
      {namedGuests.map((name) => <label className="choice" key={name}><input type="checkbox" checked={attendingNames.has(name.trim().toLowerCase())} onChange={(event) => setGuest(name, event.target.checked)} /> {name}</label>)}
      {renderAdditionalGuestFields()}
      {errors.guests && <p className="field-error" role="alert">{errors.guests}</p>}
    </fieldset>}
    {values.attendance === 'yes' && !showAttendeeSelection && namedGuests.length === 1 && extraSlots > 0 && <fieldset><legend>Additional guests</legend>
      {renderAdditionalGuestFields()}
      {errors.guests && <p className="field-error" role="alert">{errors.guests}</p>}
    </fieldset>}
    {isFeatureEnabled('dietaryRequirements') && <label className="field">Dietary requirements <span>Optional</span><textarea maxLength={RSVP_LIMITS.dietaryRequirements} value={values.dietaryRequirements} onChange={(e) => setValues((v) => ({ ...v, dietaryRequirements: e.target.value }))} rows={3} />{errors.dietaryRequirements && <small className="field-error">{errors.dietaryRequirements}</small>}</label>}
    {isFeatureEnabled('songRequest') && <label className="field">A song for the celebration <span>Optional</span><input type="text" maxLength={RSVP_LIMITS.songRequest} value={values.songRequest} onChange={(e) => setValues((v) => ({ ...v, songRequest: e.target.value }))} />{errors.songRequest && <small className="field-error">{errors.songRequest}</small>}</label>}
    {isFeatureEnabled('coupleMessage') && <label className="field">A message for the couple <span>Optional</span><textarea maxLength={RSVP_LIMITS.message} value={values.message} onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))} rows={4} />{errors.message && <small className="field-error">{errors.message}</small>}</label>}
    <label className="rsvp-form__trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <button className="button button--primary rsvp-form__submit" type="submit" disabled={submitting}>{submitting ? 'Sending…' : existing ? 'Update RSVP' : 'Send RSVP'}</button>
    {result === 'success' && <p role="status">Thank you. Your reply has been saved.</p>}
    {result === 'failure' && <p role="alert">We couldn’t save your reply. Your answers are still here; please try again.</p>}
  </form>
}
