type SectionPlaceholderProps = {
  id: string
  title: string
  note: string
  index: number
}

export function SectionPlaceholder({ id, title, note, index }: SectionPlaceholderProps) {
  return (
    <section className={`content-section${index % 2 === 1 ? ' content-section--soft' : ''}`} id={id} aria-labelledby={`${id}-title`}>
      <div className="content-section__inner">
        <p className="eyebrow">Section {String(index + 1).padStart(2, '0')}</p>
        <h2 id={`${id}-title`}>{title}</h2>
        <p className="placeholder-copy">{note}</p>
      </div>
    </section>
  )
}
