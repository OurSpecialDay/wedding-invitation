import { useEffect, useRef } from 'react'

export function ScrollIndicator() {
  const indicatorRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const indicator = indicatorRef.current
    const hero = document.getElementById('home')
    if (!indicator || !hero) return

    let heroIsVisible = false
    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver(([entry]) => {
          heroIsVisible = entry.isIntersecting
          if (heroIsVisible) {
            indicator.classList.add('is-visible')
            indicator.classList.remove('is-scrolling')
          } else {
            indicator.classList.remove('is-visible', 'is-scrolling')
          }
        }, { threshold: 0.1 })
      : null

    if (observer) observer.observe(hero)
    else {
      heroIsVisible = true
      indicator.classList.add('is-visible')
    }

    let previousScrollY = window.scrollY
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY > previousScrollY + 1) {
        indicator.classList.add('is-scrolling')
      } else if (currentScrollY < previousScrollY - 1 && heroIsVisible) {
        indicator.classList.add('is-visible')
        indicator.classList.remove('is-scrolling')
      }
      previousScrollY = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <a className="hero__scroll" href="#welcome" ref={indicatorRef}>
      <span className="hero__scroll-label">SCROLL TO EXPLORE</span>
      <span className="hero__scroll-mark" aria-hidden="true">
        <span className="hero__scroll-line" />
        <span className="hero__scroll-arrow">↓</span>
      </span>
    </a>
  )
}
