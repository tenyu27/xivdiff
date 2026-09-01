import { ROLE_LABEL, ROLE_ORDER, jobFromName } from '../lib/jobs.ts'
import type { Actor, JobInfo, RoleKey } from '../lib/types.ts'
import { JobIcon } from './JobIcon.tsx'
import './Selectors.css'

interface Props {
  players: Actor[]
  selectedId: number | null
  /** The job chosen on the opposite side, if any — marks the matching rows. */
  counterpartJob: string | null
  onSelect: (actorId: number) => void
}

interface Group {
  key: RoleKey
  label: string
  players: { actor: Actor; job: JobInfo }[]
}

/**
 * Role order is fixed and never reacts to the opposite side's selection.
 * Hoisting the matching job to the top moved rows out from under the cursor the
 * instant the other side was chosen, which produced misclicks; the match is
 * called out in place instead.
 */
function buildGroups(players: Actor[]): Group[] {
  const byRole = new Map<RoleKey, Group['players']>()

  for (const actor of players) {
    const job = jobFromName(actor.subType)
    const bucket = byRole.get(job.role) ?? []
    bucket.push({ actor, job })
    byRole.set(job.role, bucket)
  }

  return ROLE_ORDER.filter((role) => byRole.get(role)?.length).map((role) => ({
    key: role,
    label: ROLE_LABEL[role],
    players: byRole.get(role)!,
  }))
}

export function PlayerSelector({
  players,
  selectedId,
  counterpartJob,
  onSelect,
}: Props) {
  const groups = buildGroups(players)

  return (
    <div className="player-groups">
      {groups.map((group) => (
        <section key={group.key}>
          <h4 className="section-label">{group.label}</h4>
          <ul className="row-list row-list-split" aria-label={group.label}>
            {group.players.map(({ actor, job }) => {
              const selected = actor.id === selectedId
              const matches =
                counterpartJob != null && job.abbreviation === counterpartJob

              const classes = ['row-card']
              if (selected) classes.push('row-card-selected')
              if (matches) classes.push('row-card-match')

              return (
                <li key={actor.id}>
                  <button
                    type="button"
                    className={classes.join(' ')}
                    aria-pressed={selected}
                    onClick={() => onSelect(actor.id)}
                  >
                    <JobIcon job={job} />
                    <span className="player-name">{actor.name}</span>
                    {matches && <span className="player-match">match</span>}
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
