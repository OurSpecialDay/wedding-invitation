import { Header } from './components/Header'
import { SectionPlaceholder } from './components/SectionPlaceholder'

const sections = [
  { id: 'story', title: 'Our story', note: 'Our story will be shared here.' },
  { id: 'details', title: 'Wedding details', note: 'Date, time, and venue details to come.' },
  { id: 'gallery', title: 'Photo gallery', note: 'Photos will be added here.' },
  { id: 'rsvp', title: 'RSVP', note: 'RSVP details will be available soon.' },
  {
    id: 'travel',
    title: 'Travel & accommodation',
    note: 'Travel and accommodation information to come.',
  },
  { id: 'faq', title: 'Frequently asked questions', note: 'Answers to common questions will be added here.' },
]

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <section className="hero" id="home" aria-labelledby="hero-title">
          <p className="eyebrow">A celebration is in the making</p>
          <h1 id="hero-title">Wedding Invitation</h1>
          <p className="hero__names">Names to be added</p>
          <p className="hero__date">Wedding date and location to come</p>
          <a className="text-link" href="#details">Explore the details <span aria-hidden="true">↓</span></a>
        </section>
        <div className="sections">
          {sections.map((section, index) => (
            <SectionPlaceholder key={section.id} {...section} index={index} />
          ))}
        </div>
      </main>
      <footer className="footer">
        <p>More details will be shared here soon.</p>
      </footer>
    </>
  )
}
