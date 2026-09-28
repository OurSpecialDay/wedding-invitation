import { Footer } from './components/Footer'
import { GalleryPreview } from './components/GalleryPreview'
import { Header } from './components/Header'
import { PhotoFrame } from './components/PhotoFrame'
import { RSVPCallToAction } from './components/RSVPCallToAction'
import { SectionHeading } from './components/SectionHeading'
import { coupleDisplayName, coupleFullNames, wedding } from './content/wedding'

const eventDetails = [
  { label: 'Date', value: wedding.date.display },
  { label: 'Ceremony', value: wedding.ceremonyTime },
  { label: 'Reception', value: wedding.receptionTime },
  { label: 'Location', value: `${wedding.venue.room}, ${wedding.venue.hotel}` },
]

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <section className="hero" id="home" aria-labelledby="hero-title">
          <div className="hero__copy">
            <p className="eyebrow">With joy, we invite you</p>
            <h1 id="hero-title">{coupleDisplayName}</h1>
            <p className="hero__full-names">{coupleFullNames}</p>
            <time className="hero__date" dateTime={wedding.date.iso}>{wedding.date.display}</time>
            <p className="hero__intro">A day to gather, celebrate, and make memories together.</p>
            <a className="button button--primary" href="#rsvp">RSVP details <span aria-hidden="true">↗</span></a>
          </div>
          <PhotoFrame
            className="hero__photo"
            label="Hero photograph"
            src={`${import.meta.env.BASE_URL}images/main-image.jpeg`}
            alt="Main Couple Photograph"
          />
          <a className="hero__scroll" href="#welcome">Scroll to explore <span aria-hidden="true">↓</span></a>
        </section>

        <section className="welcome section-shell" id="welcome" aria-labelledby="welcome-title">
          <PhotoFrame
            className="welcome__photo" 
            label="A detail from the celebration"
            src={`${import.meta.env.BASE_URL}images/getting-married.jpeg`}
            alt="Getting married photograph"
          />
          <div className="welcome__copy">
            <p className="eyebrow">A little beginning</p>
            <h2 id="welcome-title">We’re getting married</h2>
            <p>We’re so happy to share this next chapter with the people we love. More of our story and celebration details will be added here soon.</p>
            <a className="text-link" href="#story">A little about us <span aria-hidden="true">→</span></a>
          </div>
        </section>

        <section className="details" id="details" aria-labelledby="details-title">
          <div className="section-shell details__inner">
            <SectionHeading eyebrow="The celebration" title="Wedding details" id="details-title" align="center" />
            <dl className="details-grid">
              {eventDetails.map((detail) => (
                <div className="detail" key={detail.label}>
                  <dt>{detail.label}</dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
            <div className="venue-links" aria-label="Venue links">
              <a className="text-link" href={wedding.venue.website}>Venue information <span aria-hidden="true">↗</span></a>
              <a className="text-link" href={wedding.venue.map}>Open map <span aria-hidden="true">↗</span></a>
            </div>
            <a className="text-link" href="#rsvp">Questions? RSVP details <span aria-hidden="true">→</span></a>
          </div>
        </section>

        <section className="story section-shell" id="story" aria-labelledby="story-title">
          <div className="story__copy">
            <SectionHeading eyebrow="The two of us" title="Our story" id="story-title" />
            <p>A few words about how your story began will go here. This space is ready for the moments and memories you’d like to share.</p>
            <a className="text-link" href="#gallery">More moments <span aria-hidden="true">→</span></a>
          </div>
          <PhotoFrame
            className="story__photo"
            label="A photograph for the story"
            src={`${import.meta.env.BASE_URL}images/our-story.jpeg`}
            alt="Our story photograph"
          />
        </section>

        <GalleryPreview />
        <RSVPCallToAction />
      </main>
      <Footer />
    </>
  )
}
