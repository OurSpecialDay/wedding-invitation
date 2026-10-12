import { lazy, Suspense, useLayoutEffect, useState } from 'react'
import { Footer } from './components/Footer'
import { CouplePhoto } from './components/CouplePhoto'
import { Header } from './components/Header'
import { InvitationExperience } from './components/InvitationExperience'
import { LoveStory } from './components/LoveStory'
import { RSVPCallToAction } from './components/RSVPCallToAction'
import { ReachOut } from './components/ReachOut'
import { coupleFullNames, wedding } from './config/wedding'
import { formatEventDate } from './lib/event-time'
import { isFeatureEnabled } from './config/featureFlags'

const GalleryPreview = lazy(() => import('./components/GalleryPreview').then(({ GalleryPreview }) => ({ default: GalleryPreview })))

function currentRsvpToken(): string | null {
  const base = import.meta.env.BASE_URL
  const fallback = new URLSearchParams(window.location.search).get('__ghPagesRoute')
  if (fallback && /^rsvp\/[A-Za-z0-9_-]{32}$/.test(fallback)) {
    window.history.replaceState(null, '', `${base}${fallback}`)
    return fallback.split('/')[1]
  }

  const path = window.location.pathname
  if (!path.startsWith(base)) return null
  const route = path.slice(base.length).replace(/^\/+|\/+$/g, '')
  return /^rsvp\/[A-Za-z0-9_-]{32}$/.test(route) ? route.split('/')[1] : null
}

export default function App() {
  const token = currentRsvpToken()
  const [guestName, setGuestName] = useState('Guest')
  const parentsInvitation = isFeatureEnabled('parentsInvitation')
  const brideSide = wedding.invitation?.parents?.brideSide
  const groomSide = wedding.invitation?.parents?.groomSide
  const parentInvitationText = typeof brideSide === 'string' && brideSide.trim() &&
    typeof groomSide === 'string' && groomSide.trim()
    ? <>{brideSide} together with<br />{groomSide}, have the pleasure of inviting you to the wedding of their children,</>
    : null

  useLayoutEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('.scroll-reveal')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!('IntersectionObserver' in window)) return

    targets.forEach((target) => target.classList.add('is-pending'))
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.remove('is-pending')
        entry.target.classList.add('is-revealed')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' })

    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [])

  if (!token && window.location.pathname !== import.meta.env.BASE_URL && window.location.pathname !== `${import.meta.env.BASE_URL}index.html`) {
    return <main className="rsvp-page"><h1>Page not found</h1><a href={import.meta.env.BASE_URL}>Return to the wedding website</a></main>
  }

  return (
    <InvitationExperience guestName={guestName}>
      <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <section className="hero" id="home" aria-labelledby="hero-title">
          <div className="hero__copy">
            <p className="eyebrow hero__entrance hero__entrance--1">{parentsInvitation && parentInvitationText ? parentInvitationText : 'With joy, we invite you'}</p>
            <h1 id="hero-title" className="hero__title" aria-label={`${wedding.couple.bride.displayName} and ${wedding.couple.groom.displayName}`}>
              <span className="hero__name hero__entrance hero__entrance--2">{wedding.couple.bride.displayName}</span>
              <span className="hero__ampersand hero__entrance hero__entrance--3" aria-hidden="true">&amp;</span>
              <span className="hero__name hero__entrance hero__entrance--4">{wedding.couple.groom.displayName}</span>
            </h1>
            {!parentsInvitation && <p className="hero__full-names hero__entrance hero__entrance--5">{coupleFullNames}</p>}
            <time className="hero__date hero__entrance hero__entrance--5" dateTime={wedding.eventDateTime}>{formatEventDate(wedding.eventDateTime, wedding.eventTimeZone)}</time>
            <p className="hero__intro hero__entrance hero__entrance--6">A day to gather, celebrate, and make memories together.</p>
            <a className="button button--primary hero__entrance hero__entrance--7" href="#rsvp">RSVP</a>
          </div>
          <CouplePhoto />
          <a className="hero__scroll-cue" href="#welcome" aria-label="Scroll down to read our story">
            <span>Scroll</span>
            <span className="hero__scroll-arrow" aria-hidden="true">↓</span>
          </a>
        </section>

        <LoveStory />

        <section className="details" id="details" aria-labelledby="details-title">
          <div className="section-shell details__inner">
            <div className="details__feature">
              <img
                className="details__image scroll-reveal scroll-reveal--image"
                src={`${import.meta.env.BASE_URL}images/wedding-details.jpeg`}
                alt="A photograph from our story"
              />
              <div className="details__copy scroll-reveal scroll-reveal--delay-1">
                <h2 id="details-title">You’re Invited to Our Special Day</h2>
                <dl className="details__list">
                  <div className="details__item">
                    <dt>{wedding.dateLabel}</dt>
                    <dd><time dateTime={wedding.eventDateTime}>{formatEventDate(wedding.eventDateTime, wedding.eventTimeZone)}</time></dd>
                  </div>
                  <div className="details__item">
                    <dt>{wedding.schedule.ceremony.label}</dt>
                    <dd>{wedding.schedule.ceremony.time}</dd>
                  </div>
                  <div className="details__item">
                    <dt>{wedding.schedule.reception.label}</dt>
                    <dd>{wedding.schedule.reception.time}</dd>
                  </div>
                  <div className="details__item">
                    <dt>{wedding.venue.label}</dt>
                    <dd>{wedding.venue.room}, {wedding.venue.hotel}</dd>
                  </div>
                </dl>
                <div className="venue-links" aria-label="Venue links">
                  <a className="text-link" href={wedding.venue.map}>View map</a>
                </div>
                <a className="button button--primary details__rsvp scroll-reveal scroll-reveal--delay-3" href="#rsvp">RSVP</a>
              </div>
            </div>
          </div>
        </section>

        {isFeatureEnabled('gallery') && (
          <Suspense fallback={null}>
            <GalleryPreview />
          </Suspense>
        )}
        <RSVPCallToAction token={token ?? undefined} onGuestNameLoaded={setGuestName} />
        <ReachOut />
      </main>
      <Footer />
      </>
    </InvitationExperience>
  )
}
