type PhotoFrameProps = {
  label: string
  className?: string
  src?: string
  alt?: string
  loading?: 'eager' | 'lazy'
  fetchPriority?: 'high' | 'low' | 'auto'
}

export function PhotoFrame({ label, className = '', src, alt, loading = 'lazy', fetchPriority }: PhotoFrameProps) {
  return (
    <figure className={`photo-frame ${className}`}>
      {src ? (
        <img src={src} alt={alt ?? label} loading={loading} fetchPriority={fetchPriority} />
      ) : (
        <div className="photo-frame__placeholder" role="img" aria-label={`${label}: placeholder image, replace with your own photograph`}>
          <span className="photo-frame__mark" aria-hidden="true">✳</span>
          <span className="photo-frame__label">Your photograph<br />will go here</span>
        </div>
      )}
      {!src && <figcaption className="photo-frame__caption">{label} · photo placeholder</figcaption>}
    </figure>
  )
}
