import { coupleDisplayName, wedding } from '../content/wedding'

const footerLinks = [
  { href: '#details', label: 'The day' },
  { href: '#rsvp', label: 'RSVP' },
]

export function Footer() {
  return (
    <footer className="site-footer">
      <a className="site-footer__brand scroll-reveal" href="#home">{coupleDisplayName}</a>
      <p className="site-footer__date scroll-reveal scroll-reveal--delay-1">{wedding.date.display}</p>
      <nav aria-label="Footer navigation" className="site-footer__nav scroll-reveal scroll-reveal--delay-2">
        {footerLinks.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
      </nav>
      <p className="site-footer__copyright scroll-reveal scroll-reveal--delay-3">Made with love · © {new Date().getFullYear()}</p>
    </footer>
  )
}
