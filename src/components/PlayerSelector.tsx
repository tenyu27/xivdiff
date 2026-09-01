import { jobIconUrl } from '../lib/api/xivapi.ts'
import { ROLE_LABEL, ROLE_ORDER, jobFromName } from '../lib/jobs.ts'
import type { Actor, JobInfo, RoleKey } from '../lib/types.ts'
import './Selectors.css'

interface Props {
  players: Actor[]
  selectedId: number | null
  /** The job chosen on the opposite side, if any — drives Same Job hoisting. */
  counterpartJob: string | null
  onSelect: (actorId: number) => void
}

interface Group {
  key: string
  label: string
  players: { actor: Actor; job: JobInfo }[]
}

function buildGroups(players: Actor[], counterpartJob: string | null): Group[] {
  const entries = players.map((actor) => ({
    actor,
    job: jobFromName(actor.subType),
  }))

  const matching = counterpartJob
    ? entries.filter((entry) => entry.job.abbreviation === counterpartJob)
    : []

  // With a job already chosen opposite, the same-job players are the answer
  // the user is looking for; everything else is a deliberate cross-job choice.
  const rest = entries.filter((entry) => !matching.includes(entry))
  const groups: Group[] = []

  if (matching.length > 0) {
    groups.push({ key: 'same', label: 'Same Job', players: matching })
  }

  const byRole = new Map<RoleKey, typeof entries>()
  for (const entry of rest) {
    const bucket = byRole.get(entry.job.role) ?? []
    bucket.push(entry)
    byRole.set(entry.job.role, bucket)
  }

  for (const role of ROLE_ORDER) {
    const bucket = byRole.get(role)
    if (!bucket?.length) continue
    groups.push({
      key: role,
      label: matching.length > 0 ? `Other Jobs — ${ROLE_LABEL[role]}` : ROLE_LABEL[role],
      players: bucket,
    })
  }

  return groups
}

export function PlayerSelector({
  players,
  selectedId,
  counterpartJob,
  onSelect,
}: Props) {
  const groups = buildGroups(players, counterpartJob)

  return (
    <div className="player-groups">
      {groups.map((group) => (
        <section key={group.key}>
          <h4 className="section-label">{group.label}</h4>
          <ul className="row-list" aria-label={group.label}>
            {group.players.map(({ actor, job }) => {
              const selected = actor.id === selectedId
              const icon = jobIconUrl(job.id)

              return (
                <li key={actor.id}>
                  <button
                    type="button"
                    className={
                      selected ? 'row-card row-card-selected' : 'row-card'
                    }
                    aria-pressed={selected}
                    onClick={() => onSelect(actor.id)}
                  >
                    {icon ? (
                      <img
                        className="job-icon"
                        src={icon}
                        alt=""
                        width={24}
                        height={24}
                        loading="lazy"
                      />
                    ) : (
                      <span className="job-icon job-icon-blank" />
                    )}
                    <span className="player-name">{actor.name}</span>
                    <span className="mono job-abbr">{job.abbreviation}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
