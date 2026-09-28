import { coupleDisplayName, wedding } from '../content/wedding'

const footerLinks = [
  { href: '#story', label: 'Our story' },
  { href: '#details', label: 'The day' },
  { href: '#gallery', label: 'Gallery' },
  { href: '#rsvp', label: 'RSVP' },
]

export function Footer() {
  return (
    <footer className="site-footer">
      <a className="site-footer__brand" href="#home">{coupleDisplayName}</a>
      <p className="site-footer__date">{wedding.date.display}</p>
      <nav aria-label="Footer navigation" className="site-footer__nav">
        {footerLinks.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
      </nav>
      <p className="site-footer__copyright">Made with love · © {new Date().getFullYear()}</p>
    </footer>
  )
}
