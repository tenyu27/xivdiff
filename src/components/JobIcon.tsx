import { jobIconUrl } from '../lib/api/xivapi.ts'
import type { JobInfo } from '../lib/types.ts'

interface Props {
  job: JobInfo
  size?: number
}

/**
 * Job identity is carried by the icon alone — the abbreviation stays in `alt`
 * so the information is still available to a screen reader and on hover.
 */
export function JobIcon({ job, size = 24 }: Props) {
  const url = jobIconUrl(job.id)
  const style = { width: size, height: size }

  if (!url) {
    return <span className="job-icon job-icon-blank" style={style} />
  }

  return (
    <img
      className="job-icon"
      src={url}
      alt={job.abbreviation}
      title={job.name}
      width={size}
      height={size}
      style={style}
      loading="lazy"
    />
  )
}
