import { useEffect, useMemo, useRef, useState } from 'react'
import { buildAdminGroups, buildAdminGuests, csvText, dashboardMetrics, formatRate, type AdminData, type AdminGroup, type AdminGuest } from './model'
import { AdminServiceError, getAdminData } from './adminService'

type Section = 'dashboard' | 'guests' | 'reports'
type Report = 'outstanding' | 'confirmed' | 'declined' | 'summary' | 'answers'
const reportNames: Record<Report, string> = { outstanding: 'Outstanding RSVPs', confirmed: 'Confirmed attendance', declined: 'Declines', summary: 'Invitation summary', answers: 'Additional answers' }
const responseLabel = (status: AdminGroup['responseStatus']) => ({ pending: 'Awaiting reply', confirmed: 'Accepted', declined: 'Declined', unknown: 'Unclear response' })[status]
const attendanceLabel = (status: AdminGuest['attendanceStatus']) => ({ attending: 'Attending', declined: 'Not attending', unknown: 'Unknown' })[status]
const dateLabel = (value: string) => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.valueOf()) ? date.toLocaleString() : '—' }
export default function AdminApp() {
  const [data, setData] = useState<AdminData | null>(null)
  const [section, setSection] = useState<Section>('dashboard')
  const [report, setReport] = useState<Report>('outstanding')
  const [search, setSearch] = useState('')
  const [responseFilter, setResponseFilter] = useState('all')
  const [attendanceFilter, setAttendanceFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adminCode, setAdminCode] = useState('')
  const pageSize = 20

  async function refresh() {
    setLoading(true)
    if (!adminCode) { setLoading(false); setError('Enter the admin code to view RSVP data.'); return }
    try {
      const result = await getAdminData(adminCode)
      setData(result)
      setFetchedAt(new Date())
      setError('')
    } catch (requestError) {
      const code = requestError instanceof AdminServiceError ? requestError.code : 'backend'
      if (code === 'invalid_code') {
        setError('That admin code is incorrect. Try again.')
      } else if (code === 'invalid_response') {
        setError('Apps Script returned RSVP data in a format this admin page cannot use. Update Code.gs and AdminBridge.html in the Apps Script deployment, then rebuild and redeploy this site.')
      } else if (code === 'connection') {
        setError('The admin connection could not start. Check the Apps Script deployment URL and allowed site origin.')
      } else if (code === 'not_configured') {
        setError('The admin Apps Script deployment URL is not configured in this site build.')
      } else {
        setError('Apps Script connected but could not return RSVP data. Check the Apps Script execution details and Sheet authorization.')
      }
    } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])

  const groups = useMemo(() => data ? buildAdminGroups(data) : [], [data])
  const guests = useMemo(() => buildAdminGuests(groups), [groups])
  const metrics = useMemo(() => dashboardMetrics(groups, guests), [groups, guests])
  const matchingGuests = useMemo(() => guests.filter((guest) => {
    const query = search.trim().toLocaleLowerCase()
    const textMatches = !query || guest.name.toLocaleLowerCase().includes(query) || guest.invitationName.toLocaleLowerCase().includes(query)
    return textMatches && (responseFilter === 'all' || guest.responseStatus === responseFilter)
      && (attendanceFilter === 'all' || guest.attendanceStatus === attendanceFilter)
  }), [guests, search, responseFilter, attendanceFilter])
  const reportGroups = useMemo(() => {
    if (report === 'outstanding') return groups.filter(({ invitation, responseStatus }) => invitation.active && (responseStatus === 'pending' || responseStatus === 'unknown'))
    if (report === 'confirmed') return groups.filter(({ responseStatus }) => responseStatus === 'confirmed')
    if (report === 'declined') return groups.filter(({ responseStatus }) => responseStatus === 'declined')
    return groups
  }, [groups, report])
  const reportRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (report === 'confirmed' || report === 'declined') return guests.filter((guest) => (report === 'confirmed' ? guest.attendanceStatus === 'attending' : guest.attendanceStatus === 'declined') && (!query || `${guest.name} ${guest.invitationName}`.toLocaleLowerCase().includes(query)))
    if (report === 'answers') return reportGroups.filter(({ invitation, invitees, response }) => Boolean(response && (response.dietaryRequirements || response.songRequest || response.message)) && (!query || `${invitation.primaryGuestName} ${invitees.join(' ')} ${response?.dietaryRequirements} ${response?.songRequest} ${response?.message}`.toLocaleLowerCase().includes(query)))
    return reportGroups.filter(({ invitation, invitees }) => !query || `${invitation.primaryGuestName} ${invitees.join(' ')}`.toLocaleLowerCase().includes(query))
  }, [report, reportGroups, guests, search])
  const selectedGroup = groups.find(({ id }) => id === selected) ?? null
  useEffect(() => {
    if (selectedGroup && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal()
  }, [selectedGroup])
  const duplicateResponses = data?.duplicateResponseCount ?? 0

  function exportReport() {
    let headers: string[]
    let rows: (string | number | boolean | null)[][]
    if (report === 'confirmed' || report === 'declined') {
      headers = ['Guest name', 'Invitation', 'Attendance', 'RSVP submitted', 'Dietary requirements']
      rows = (reportRows as AdminGuest[]).map((guest) => [guest.name, guest.invitationName, attendanceLabel(guest.attendanceStatus), guest.submittedAt, guest.dietaryRequirements])
    } else if (report === 'answers') {
      headers = ['Invitation', 'Recorded guests', 'Dietary requirements', 'Song request', 'Message', 'RSVP submitted']
      rows = (reportRows as AdminGroup[]).map((group) => [group.invitation.primaryGuestName, group.response?.guests.map(({ name }) => name).join('; ') ?? '', group.response?.dietaryRequirements ?? '', group.response?.songRequest ?? '', group.response?.message ?? '', group.response?.submittedAt ?? ''])
    } else {
      headers = ['Invitation', 'Guests', 'RSVP status', 'Attending guests', 'Invitation active', 'RSVP submitted']
      rows = (reportRows as AdminGroup[]).map((group) => [group.invitation.primaryGuestName, group.invitees.join('; '), responseLabel(group.responseStatus), group.response?.attending ? group.response.guests.length : 0, group.invitation.active, group.response?.submittedAt ?? ''])
    }
    const blob = new Blob([csvText(headers, rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `wedding-${report}-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function go(next: Section) { setSection(next); setSearch(''); setPage(0); setSelected(null) }

  return <main className="admin-shell">
    <a className="admin-skip" href="#admin-content">Skip to admin content</a>
    <header className="admin-header">
      <a className="admin-brand" href={`${import.meta.env.BASE_URL}`} aria-label="Wedding website">Wedding <span>RSVP</span></a>
      <div className="admin-header__right"><span className="admin-freshness">{fetchedAt ? `Updated ${fetchedAt.toLocaleTimeString()}` : 'Not yet updated'}</span><button type="button" className="admin-button admin-button--quiet" onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh data'}</button></div>
    </header>
    <div className="admin-layout">
      <nav className="admin-nav" aria-label="Admin sections">{(['dashboard', 'guests', 'reports'] as const).map((item) => <button type="button" key={item} aria-current={section === item ? 'page' : undefined} onClick={() => go(item)}>{item === 'guests' ? 'Guest management' : item[0].toUpperCase() + item.slice(1)}</button>)}</nav>
      <section id="admin-content" className="admin-main" aria-live="polite">
        <div className="admin-page-title"><div><p className="admin-eyebrow">Wedding RSVP</p><h1>{section === 'guests' ? 'Guest management' : section[0].toUpperCase() + section.slice(1)}</h1></div></div>
        {!data && <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); void refresh() }}><label htmlFor="admin-code">Admin code<input id="admin-code" value={adminCode} onChange={(event) => setAdminCode(event.target.value)} type="password" autoComplete="current-password" /></label><button className="admin-button" type="submit" disabled={loading}>Open admin page</button></form>}
        {error && <div className="admin-alert" role="alert"><p>{error}</p></div>}
        {loading && !data && <p className="admin-message" role="status">Connecting and loading RSVP records…</p>}
        {!loading && !data && !error && <p className="admin-message">Admin data is not configured.</p>}
        {data && section === 'dashboard' && <>
          <div className="admin-metrics">
            <Metric label="Invitation groups" value={metrics.invitationGroups} note="Active invitations" />
            <Metric label="Named individuals" value={metrics.individualGuests} note="People listed on active invitations" />
            <Metric label="Groups responded" value={metrics.respondedGroups} note={`${metrics.pendingGroups} awaiting a valid reply`} />
            <Metric label="Response rate" value={formatRate(metrics.responseRate)} note="Of active invitation groups" />
            <Metric label="Attending" value={metrics.attending} note="Individual guests recorded as attending" />
            <Metric label="Declining" value={metrics.declined} note="Individual guests recorded as declining" />
            <Metric label="Attendance rate" value={formatRate(metrics.attendanceRate)} note="Attending ÷ confirmed attendance decisions" />
          </div>
          <div className="admin-dashboard-grid"><section className="admin-card"><h2>RSVP progress</h2><div className="admin-progress" role="img" aria-label={`${metrics.respondedGroups} of ${metrics.invitationGroups} active invitation groups have responded`}><span style={{ width: `${metrics.responseRate == null ? 0 : Math.round(metrics.responseRate * 100)}%` }} /></div><p>{metrics.respondedGroups} responded · {metrics.pendingGroups} pending</p><p className="admin-muted">Pending includes invitations without a valid yes or no reply. {metrics.unknownResponses ? `${metrics.unknownResponses} response record(s) have an unrecognized or incomplete attendance value.` : ''}</p></section><section className="admin-card"><h2>Attendance breakdown</h2><p className="admin-breakdown"><strong>{metrics.attending}</strong> attending <span>·</span> <strong>{metrics.declined}</strong> declining</p><p className="admin-muted">Unnamed guest capacity is not counted as an invited individual until a guest name is recorded in an RSVP.</p></section></div>
        </>}
        {data && section === 'guests' && <>
          <div className="admin-filters"><label>Search guest or invitation<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} type="search" /></label><label>RSVP status<select value={responseFilter} onChange={(event) => { setResponseFilter(event.target.value); setPage(0) }}><option value="all">All statuses</option><option value="pending">Awaiting reply</option><option value="confirmed">Accepted</option><option value="declined">Declined</option><option value="unknown">Unclear response</option></select></label><label>Attendance<select value={attendanceFilter} onChange={(event) => { setAttendanceFilter(event.target.value); setPage(0) }}><option value="all">All attendance</option><option value="attending">Attending</option><option value="declined">Not attending</option><option value="unknown">Unknown</option></select></label><button className="admin-button admin-button--quiet" type="button" onClick={() => { setSearch(''); setResponseFilter('all'); setAttendanceFilter('all'); setPage(0) }}>Clear filters</button></div>
          <p className="admin-results">{matchingGuests.length} matching individual guests · Page {matchingGuests.length ? page + 1 : 0} of {Math.ceil(matchingGuests.length / pageSize)}</p>
          <GuestTable guests={matchingGuests.slice(page * pageSize, (page + 1) * pageSize)} onSelect={(token) => setSelected(token)} />
          <Pager page={page} pages={Math.ceil(matchingGuests.length / pageSize)} setPage={setPage} />
        </>}
        {data && section === 'reports' && <>
          <div className="admin-report-controls"><label>Report<select value={report} onChange={(event) => { setReport(event.target.value as Report); setSearch(''); setPage(0) }}>{Object.entries(reportNames).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label>Filter report<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} /></label><button className="admin-button" type="button" onClick={exportReport} disabled={!reportRows.length}>Export CSV</button></div>
          <p className="admin-results">{reportRows.length} matching {report === 'confirmed' || report === 'declined' ? 'individual guests' : 'invitation groups'}</p>
          {report === 'confirmed' || report === 'declined' ? <GuestTable guests={(reportRows as AdminGuest[]).slice(page * pageSize, (page + 1) * pageSize)} onSelect={(token) => setSelected(token)} /> : report === 'answers' ? <AnswerTable groups={(reportRows as AdminGroup[]).slice(page * pageSize, (page + 1) * pageSize)} onSelect={(token) => setSelected(token)} /> : <GroupTable groups={(reportRows as AdminGroup[]).slice(page * pageSize, (page + 1) * pageSize)} onSelect={(token) => setSelected(token)} />}
          <Pager page={page} pages={Math.ceil(reportRows.length / pageSize)} setPage={setPage} />
        </>}
        {data && duplicateResponses > 0 && <p className="admin-warning" role="status">Data quality note: {duplicateResponses} duplicate response row(s) share an invitation token. The first stored row is shown to match the existing public RSVP lookup.</p>}
        {data && groups.filter(({ invitation }) => invitation.active && invitation.invitedGuestNames == null).length > 0 && <p className="admin-warning" role="status">Data quality note: {groups.filter(({ invitation }) => invitation.active && invitation.invitedGuestNames == null).length} active invitation(s) have an unreadable guest list. Those people are omitted from named guest totals and shown without inferred relationships.</p>}
        {data && data.orphanResponseCount > 0 && <p className="admin-warning" role="status">Data quality note: {data.orphanResponseCount} response row(s) do not match an invitation and are excluded from joined reports.</p>}
      </section>
    </div>
    {selectedGroup && <dialog ref={dialogRef} className="admin-modal" aria-labelledby="detail-title" onClose={() => setSelected(null)} onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close() }}><button type="button" className="admin-modal__close" onClick={() => dialogRef.current?.close()} aria-label="Close invitation details">×</button><p className="admin-eyebrow">Invitation details</p><h2 id="detail-title">{selectedGroup.invitation.primaryGuestName || 'Unnamed invitation'}</h2><p>{responseLabel(selectedGroup.responseStatus)} · {selectedGroup.invitation.active ? 'Active invitation' : 'Inactive invitation'}</p><h3>Named guests</h3>{selectedGroup.invitation.invitedGuestNames == null ? <p>Guest list unavailable because its stored data could not be read.</p> : <ul>{selectedGroup.invitees.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}{!selectedGroup.invitees.length && <li>No individual names are listed.</li>}</ul>}{selectedGroup.response && <><h3>Recorded RSVP</h3><dl className="admin-detail-list"><dt>Attendance</dt><dd>{selectedGroup.response.attending == null ? 'Unrecognized value' : selectedGroup.response.attending ? 'Accepts' : 'Declines'}</dd><dt>Attending guest names</dt><dd>{selectedGroup.response.guests.map(({ name }) => name).join(', ') || '—'}</dd><dt>Submitted</dt><dd>{dateLabel(selectedGroup.response.submittedAt)}</dd><dt>Updated</dt><dd>{dateLabel(selectedGroup.response.updatedAt)}</dd><dt>Dietary requirements</dt><dd>{selectedGroup.response.dietaryRequirements || '—'}</dd><dt>Song request</dt><dd>{selectedGroup.response.songRequest || '—'}</dd><dt>Message</dt><dd>{selectedGroup.response.message || '—'}</dd></dl></>}</dialog>}
  </main>
}

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) { return <article className="admin-metric"><h2>{label}</h2><strong>{value}</strong><p>{note}</p></article> }
function GuestTable({ guests, onSelect }: { guests: AdminGuest[]; onSelect: (groupId: string) => void }) {
  if (!guests.length) return <p className="admin-empty">No matching guest records.</p>
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Guest</th><th>Invitation</th><th>RSVP</th><th>Attendance</th><th>Submitted</th></tr></thead><tbody>{guests.map((guest, index) => <tr key={`${guest.groupId}-${guest.name}-${index}`}><td><button className="admin-link-button" onClick={() => onSelect(guest.groupId)} type="button">{guest.name}</button></td><td>{guest.invitationName}</td><td>{responseLabel(guest.responseStatus)}</td><td>{attendanceLabel(guest.attendanceStatus)}</td><td>{dateLabel(guest.submittedAt)}</td></tr>)}</tbody></table></div>
}
function GroupTable({ groups, onSelect }: { groups: AdminGroup[]; onSelect: (groupId: string) => void }) {
  if (!groups.length) return <p className="admin-empty">No matching invitation groups.</p>
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Invitation</th><th>Guests</th><th>Status</th><th>Attending</th><th>Submitted</th></tr></thead><tbody>{groups.map(({ id, invitation, invitees, response, responseStatus }) => <tr key={id}><td><button className="admin-link-button" type="button" onClick={() => onSelect(id)}>{invitation.primaryGuestName || 'Unnamed invitation'}</button></td><td>{invitees.join(', ') || '—'}</td><td>{responseLabel(responseStatus)}</td><td>{response?.attending ? response.guests.length : 0}</td><td>{dateLabel(response?.submittedAt ?? '')}</td></tr>)}</tbody></table></div>
}
function AnswerTable({ groups, onSelect }: { groups: AdminGroup[]; onSelect: (groupId: string) => void }) {
  if (!groups.length) return <p className="admin-empty">No matching RSVP answers.</p>
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Invitation</th><th>Recorded guests</th><th>Dietary requirements</th><th>Song request</th><th>Message</th><th>Submitted</th></tr></thead><tbody>{groups.map(({ id, invitation, response }) => <tr key={id}><td><button className="admin-link-button" type="button" onClick={() => onSelect(id)}>{invitation.primaryGuestName || 'Unnamed invitation'}</button></td><td>{response?.guests.map(({ name }) => name).join(', ') || '—'}</td><td>{response?.dietaryRequirements || '—'}</td><td>{response?.songRequest || '—'}</td><td>{response?.message || '—'}</td><td>{dateLabel(response?.submittedAt ?? '')}</td></tr>)}</tbody></table></div>
}
function Pager({ page, pages, setPage }: { page: number; pages: number; setPage: (value: number) => void }) { return pages > 1 ? <div className="admin-pager"><button type="button" className="admin-button admin-button--quiet" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {pages}</span><button type="button" className="admin-button admin-button--quiet" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button></div> : null }
