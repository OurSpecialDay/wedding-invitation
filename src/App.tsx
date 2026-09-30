import { useLayoutEffect } from 'react'
import { Footer } from './components/Footer'
import { CouplePhoto } from './components/CouplePhoto'
import { Header } from './components/Header'
import { LoveStory } from './components/LoveStory'
import { RSVPCallToAction } from './components/RSVPCallToAction'
import { coupleFullNames, wedding } from './content/wedding'

export default function App() {
  useLayoutEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('.scroll-reveal')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    if (!('IntersectionObserver' in window)) return

    targets.forEach((target) => target.classList.add('is-pending'))
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('is-pending')
          entry.target.classList.add('is-revealed')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' })

    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <section className="hero" id="home" aria-labelledby="hero-title">
          <div className="hero__copy">
            <p className="eyebrow hero__entrance hero__entrance--1">With joy, we invite you</p>
            <h1 id="hero-title" className="hero__title" aria-label={`${wedding.couple.bride.displayName} and ${wedding.couple.groom.displayName}`}>
              <span className="hero__name hero__entrance hero__entrance--2">{wedding.couple.bride.displayName}</span>
              <span className="hero__ampersand hero__entrance hero__entrance--3" aria-hidden="true">&amp;</span>
              <span className="hero__name hero__entrance hero__entrance--4">{wedding.couple.groom.displayName}</span>
            </h1>
            <p className="hero__full-names hero__entrance hero__entrance--5">{coupleFullNames}</p>
            <time className="hero__date hero__entrance hero__entrance--5" dateTime={wedding.date.iso}>{wedding.date.display}</time>
            <p className="hero__intro hero__entrance hero__entrance--6">A day to gather, celebrate, and make memories together.</p>
            <a className="button button--primary hero__entrance hero__entrance--7" href="#rsvp">RSVP</a>
          </div>
          <CouplePhoto />
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
                    <dt>{wedding.date.label}</dt>
                    <dd><time dateTime={wedding.date.iso}>{wedding.date.display}</time></dd>
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
                <div className="venue-links" aria-label="Map">
                  <a className="text-link" href={wedding.venue.map}>View Map</a>
                </div>
                <a className="button button--primary details__rsvp scroll-reveal scroll-reveal--delay-3" href="#rsvp">RSVP</a>
              </div>
            </div>
          </div>
        </section>

        <RSVPCallToAction />
      </main>
      <Footer />
    </>
  )
}
