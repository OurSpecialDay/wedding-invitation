const links = [
  { href: '#home', label: 'Home' },
  { href: '#story', label: 'Our story' },
  { href: '#details', label: 'Details' },
  { href: '#gallery', label: 'Gallery' },
  { href: '#rsvp', label: 'RSVP' },
  { href: '#travel', label: 'Travel' },
  { href: '#faq', label: 'FAQ' },
]

export function Header() {
  return (
    <header className="site-header">
      <a className="site-header__brand" href="#home" aria-label="Wedding Invitation, home">W<span aria-hidden="true">&</span>W</a>
      <nav aria-label="Main navigation">
        <ul className="site-nav">
          {links.map((link) => (
            <li key={link.href}><a href={link.href}>{link.label}</a></li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
