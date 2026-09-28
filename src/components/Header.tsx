import { useRef, useState } from 'react'
import { coupleDisplayName } from '../content/wedding'

const links = [
  { href: '#story', label: 'Our story' },
  { href: '#details', label: 'The day' },
  { href: '#gallery', label: 'Gallery' },
]

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <header className="site-header">
      <a className="site-header__brand" href="#home" aria-label={`${coupleDisplayName}, home`}>
        {coupleDisplayName}
      </a>
      <button
        className="menu-toggle"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="site-navigation"
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => setMenuOpen((open) => !open)}
        ref={menuButton}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      <nav
        id="site-navigation"
        className={`site-nav${menuOpen ? ' site-nav--open' : ''}`}
        aria-label="Main navigation"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && menuOpen) {
            closeMenu()
            menuButton.current?.focus()
          }
        }}
      >
        {links.map((link) => (
          <a href={link.href} key={link.href} onClick={closeMenu}>{link.label}</a>
        ))}
        <a className="site-nav__rsvp" href="#rsvp" onClick={closeMenu}>RSVP</a>
      </nav>
    </header>
  )
}
