export default function RepairMediaGallery({ media, label }) {
  if (!media?.length) return null

  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label={label}>
      {media.map((item, index) => (
        <li key={item.id}>
          {item.resource_type === 'video' ? (
            <video controls preload="metadata" className="w-full rounded-md bg-ink">
              <source src={item.url} type={`video/${item.format}`} />
              Your browser does not support video playback.
            </video>
          ) : (
            <a href={item.url} target="_blank" rel="noreferrer">
              <img
                src={item.url}
                alt={`${label} photo ${index + 1}`}
                loading="lazy"
                className="max-h-80 w-full rounded-md object-contain"
              />
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}
