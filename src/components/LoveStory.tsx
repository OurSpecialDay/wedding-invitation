export function LoveStory() {
  return (
    <section
      className="love-note"
      id="welcome"
      aria-labelledby="love-note-title"
    >
      <div className="love-note__inner">
        <div className="love-note__content">
          <img
            className="love-note__sprig scroll-reveal"
            src={`${import.meta.env.BASE_URL}images/eucalyptus-sprig.png`}
            alt=""
            aria-hidden="true"
          />
          <h2 className="love-note__title scroll-reveal" id="love-note-title">
            <span className="love-note__line">A love that</span>
            <span className="love-note__line">bloomed.</span>
          </h2>
          <div className="love-note__copy scroll-reveal">
            <p>Somewhere along the way, we found something truly special in each other.</p>
            <p>Through laughter, shared moments, and countless memories, our love grew into something that feels like home.</p>
            <p>And now, with hearts full of love, we’re ready to begin our happily ever after.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
