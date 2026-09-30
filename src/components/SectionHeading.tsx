type SectionHeadingProps = {
  eyebrow: string
  title: string
  id: string
  align?: 'left' | 'center'
}

export function SectionHeading({ eyebrow, title, id, align = 'left' }: SectionHeadingProps) {
  return (
    <div className={`section-heading section-heading--${align} scroll-reveal`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
    </div>
  )
}
