export type AdminInvitation = {
  invitationKey: string
  primaryGuestName: string
  invitedGuestNames: string[] | null
  maxGuests: number | null
  active: boolean
  createdAt: string
  revokedAt: string
}

export type AdminResponse = {
  invitationKey: string | null
  submittedAt: string
  updatedAt: string
  attending: boolean | null
  guests: { name: string }[]
  dietaryRequirements: string
  songRequest: string
  message: string
}

export type AdminData = { viewerEmail: string; invitations: AdminInvitation[]; responses: AdminResponse[]; duplicateResponseCount: number; orphanResponseCount: number }
export type AdminGroup = { id: string; invitation: AdminInvitation; response: AdminResponse | null; responseStatus: 'pending' | 'confirmed' | 'declined' | 'unknown'; invitees: string[] }
export type AdminGuest = { name: string; invitationName: string; groupId: string; responseStatus: AdminGroup['responseStatus']; attendanceStatus: 'attending' | 'declined' | 'unknown'; submittedAt: string; dietaryRequirements: string; songRequest: string; message: string }

const normalise = (value: string) => value.trim().toLocaleLowerCase()

export function buildAdminGroups(data: AdminData): AdminGroup[] {
  const responses = new Map<string, AdminResponse>()
  // The public RSVP lookup has always used the first stored response row for an invitation.
  // Keep reports consistent with that established behavior and flag duplicates.
  for (const response of data.responses) if (response.invitationKey && !responses.has(response.invitationKey)) responses.set(response.invitationKey, response)
  return data.invitations.map((invitation, index) => {
    const response = invitation.invitationKey ? responses.get(invitation.invitationKey) ?? null : null
    const responseStatus = !response ? 'pending' : response.attending === true && response.guests.length > 0 && response.guests.every(({ name }) => Boolean(name.trim())) ? 'confirmed' : response.attending === false ? 'declined' : 'unknown'
    const invitees = invitation.invitedGuestNames == null ? [] : invitation.invitedGuestNames.length ? invitation.invitedGuestNames : [invitation.primaryGuestName].filter(Boolean)
    return { id: invitation.invitationKey || `unlinked-${index}`, invitation, response, responseStatus, invitees }
  })
}

export function buildAdminGuests(groups: AdminGroup[]): AdminGuest[] {
  return groups.flatMap(({ id, invitation, response, responseStatus, invitees }) => {
    const attendees = new Set((response?.attending ? response.guests : []).map(({ name }) => normalise(name)))
    const names = [...invitees]
    if (response?.attending) {
      for (const { name } of response.guests) if (!names.some((invitee) => normalise(invitee) === normalise(name))) names.push(name)
    }
    return names.map((name) => ({
      name,
      invitationName: invitation.primaryGuestName,
      groupId: id,
      responseStatus,
      attendanceStatus: responseStatus === 'declined' ? 'declined' : responseStatus === 'confirmed' ? (attendees.has(normalise(name)) ? 'attending' : 'declined') : 'unknown',
      submittedAt: response?.submittedAt ?? '',
      dietaryRequirements: response?.dietaryRequirements ?? '',
      songRequest: response?.songRequest ?? '',
      message: response?.message ?? '',
    }))
  })
}

export function dashboardMetrics(groups: AdminGroup[], guests: AdminGuest[]) {
  const eligible = groups.filter(({ invitation }) => invitation.active)
  const eligibleTokens = new Set(eligible.map(({ id }) => id))
  const responded = eligible.filter(({ responseStatus }) => responseStatus === 'confirmed' || responseStatus === 'declined')
  const attending = guests.filter(({ attendanceStatus, groupId }) => eligibleTokens.has(groupId) && attendanceStatus === 'attending').length
  const declined = guests.filter(({ attendanceStatus, groupId }) => eligibleTokens.has(groupId) && attendanceStatus === 'declined').length
  return {
    invitationGroups: eligible.length,
    individualGuests: eligible.reduce((total, group) => total + group.invitees.length, 0),
    respondedGroups: responded.length,
    pendingGroups: eligible.length - responded.length,
    attending,
    declined,
    responseRate: eligible.length ? responded.length / eligible.length : null,
    attendanceRate: attending + declined ? attending / (attending + declined) : null,
    unknownResponses: eligible.filter(({ responseStatus }) => responseStatus === 'unknown').length,
  }
}

export function csvText(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (value: string | number | boolean | null | undefined) => {
    let text = value == null ? '' : String(value)
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  return `\uFEFF${[headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')}`
}

export function formatRate(value: number | null): string { return value == null ? 'Unavailable' : `${Math.round(value * 100)}%` }
