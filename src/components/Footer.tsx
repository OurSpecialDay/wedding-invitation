import { coupleDisplayName, wedding } from '../config/wedding'
import { formatEventDate } from '../lib/event-time'
import { isFeatureEnabled } from '../config/featureFlags'

const footerLinks = [
  { href: '#welcome', label: 'Our story' },
  { href: '#details', label: 'The day' },
  ...(isFeatureEnabled('gallery') ? [{ href: '#gallery', label: 'Gallery' }] : []),
  { href: '#rsvp', label: 'RSVP' },
  { href: `${import.meta.env.BASE_URL}privacy.html`, label: 'Privacy policy' },
]

export function Footer() {
  return (
    <footer className="site-footer">
      <a className="site-footer__brand scroll-reveal" href="#home">{coupleDisplayName}</a>
      <p className="site-footer__date scroll-reveal scroll-reveal--delay-1">{formatEventDate(wedding.eventDateTime, wedding.eventTimeZone)}</p>
      <nav aria-label="Footer navigation" className="site-footer__nav scroll-reveal scroll-reveal--delay-2">
        {footerLinks.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
      </nav>
      <p className="site-footer__copyright scroll-reveal scroll-reveal--delay-3">Made with love · © {new Date().getFullYear()}</p>
    </footer>
  )
}
