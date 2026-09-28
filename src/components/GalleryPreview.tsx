import { PhotoFrame } from './PhotoFrame'
import { SectionHeading } from './SectionHeading'

export function GalleryPreview() {
  return (
    <section className="gallery section-shell" id="gallery" aria-labelledby="gallery-title">
      <div className="gallery__heading">
        <SectionHeading eyebrow="A few favourite moments" title="Little glimpses" id="gallery-title" align="center" />
      </div>
      <div className="gallery-grid">
        <PhotoFrame
          label="Gallery photograph one"
          className="gallery-grid__item gallery-grid__item--one"
          src={`${import.meta.env.BASE_URL}images/gallery-1.jpeg`}
          alt="Gallery photograph one"
        />
        <PhotoFrame
          label="Gallery photograph two"
          className="gallery-grid__item gallery-grid__item--two"
          src={`${import.meta.env.BASE_URL}images/gallery-2.jpeg`}
          alt="Gallery photograph two"
        />
        <PhotoFrame
          label="Gallery photograph three"
          className="gallery-grid__item gallery-grid__item--three"
          src={`${import.meta.env.BASE_URL}images/gallery-3.jpeg`}
          alt="Gallery photograph three"
        />
      </div>
      <a className="text-link" href="#rsvp">Celebrate with us <span aria-hidden="true">→</span></a>
    </section>
  )
}
