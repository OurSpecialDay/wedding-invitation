import { SectionHeading } from './SectionHeading'

export function RSVPCallToAction() {
  return (
    <section className="rsvp" id="rsvp" aria-labelledby="rsvp-title">
      <div className="rsvp__inner">
        <SectionHeading eyebrow="We hope you can join us" title="Save a place for the celebration" id="rsvp-title" align="center" />
        <p>RSVP information will be shared here soon.</p>
        <a className="button button--light" href="#details">See the wedding details <span aria-hidden="true">↗</span></a>
      </div>
    </section>
  )
}
