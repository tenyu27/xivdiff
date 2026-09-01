import { useState } from 'react'
import { parseFFLogsUrl } from '../lib/fflogsUrl.ts'
import { encodeCompareState, emptySide } from '../lib/shareState.ts'
import { navigate } from '../hooks/useRoute.ts'
import './Landing.css'

interface FieldProps {
  id: string
  label: string
  helper: string
  value: string
  touched: boolean
  onChange: (value: string) => void
  onBlur: () => void
}

function UrlField({
  id,
  label,
  helper,
  value,
  touched,
  onChange,
  onBlur,
}: FieldProps) {
  const invalid = touched && value.trim() !== '' && !parseFFLogsUrl(value)

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type="text"
        spellCheck={false}
        autoComplete="off"
        placeholder="https://www.fflogs.com/reports/…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={invalid}
      />
      <p className={invalid ? 'helper helper-error' : 'helper'}>
        {invalid ? 'Invalid FFLogs URL.' : helper}
      </p>
    </div>
  )
}

export function Landing() {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [touched, setTouched] = useState({ left: false, right: false })

  const leftRef = parseFFLogsUrl(left)
  const rightRef = parseFFLogsUrl(right)
  const ready = leftRef != null && rightRef != null

  const analyze = () => {
    if (!leftRef || !rightRef) {
      setTouched({ left: true, right: true })
      return
    }

    const search = encodeCompareState({
      left: {
        ...emptySide(left),
        code: leftRef.code,
        fightId: leftRef.fightId ?? null,
      },
      right: {
        ...emptySide(right),
        code: rightRef.code,
        fightId: rightRef.fightId ?? null,
      },
      view: 'sequence',
    })

    navigate('/compare', search)
  }

  return (
    <main className="landing">
      {/* One column: the statement, then the two things to fill in. Nothing
          else — the tool explains itself the moment a log is pasted. */}
      <div className="landing-column">
        <h1 className="landing-title">
          Compare two FFXIV rotations, action by action.
        </h1>
        <p className="landing-lede">
          Paste two FFLogs reports, pick a pull and a player on each side, and
          xivdiff renders both rotations on one shared timeline — every GCD and
          every weave, realigned at each phase.
        </p>

        <section className="landing-form">
          <div className="landing-inputs">
            <UrlField
              id="left-url"
              label="Your log"
              helper="Report or pull URL."
              value={left}
              touched={touched.left}
              onChange={setLeft}
              onBlur={() => setTouched((state) => ({ ...state, left: true }))}
            />
            <UrlField
              id="right-url"
              label="Reference log"
              helper="May be the same report."
              value={right}
              touched={touched.right}
              onChange={setRight}
              onBlur={() => setTouched((state) => ({ ...state, right: true }))}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg landing-analyze"
            disabled={!ready}
            onClick={analyze}
          >
            Analyze
          </button>

          <p className="helper landing-note">
            Public reports only. A pull URL selects that fight automatically; a
            report URL asks which pull you meant.
          </p>
        </section>
      </div>
    </main>
  )
}
