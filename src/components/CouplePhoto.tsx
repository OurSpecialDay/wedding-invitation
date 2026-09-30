import { useEffect, useState } from 'react'

const PHOTO_HOLD_MS = 4500
const PHOTO_FADE_MS = 1200

export function CouplePhoto() {
  const [showSecondPhoto, setShowSecondPhoto] = useState(false)

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let intervalId: number | undefined
    const startRotation = () => {
      if (intervalId !== undefined) return
      intervalId = window.setInterval(() => {
        setShowSecondPhoto((showSecond) => !showSecond)
      }, PHOTO_HOLD_MS + PHOTO_FADE_MS)
    }
    const stopRotation = () => {
      if (intervalId !== undefined) window.clearInterval(intervalId)
      intervalId = undefined
    }

    if (!motionPreference.matches) startRotation()

    const handleMotionPreference = (event: MediaQueryListEvent) => {
      if (event.matches) {
        stopRotation()
        setShowSecondPhoto(false)
      } else {
        startRotation()
      }
    }

    motionPreference.addEventListener('change', handleMotionPreference)
    return () => {
      stopRotation()
      motionPreference.removeEventListener('change', handleMotionPreference)
    }
  }, [])

  return (
    <figure className={`photo-frame hero__photo${showSecondPhoto ? ' hero__photo--second' : ''}`}>
      <img
        className="hero__image hero__image--first"
        src={`${import.meta.env.BASE_URL}images/gallery-4.jpeg`}
        alt="Main Couple Photograph"
        loading="eager"
        fetchPriority="high"
      />
      <img
        className="hero__image hero__image--second"
        src={`${import.meta.env.BASE_URL}images/gallery-5.jpeg`}
        alt=""
        aria-hidden="true"
        loading="eager"
        fetchPriority="low"
      />
    </figure>
  )
}
