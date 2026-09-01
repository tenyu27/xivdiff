import { useState } from 'react'
import { getApiBase, setApiBase } from '../lib/api/client.ts'
import { navigate } from '../hooks/useRoute.ts'
import './Settings.css'

export function Settings() {
  const [value, setValue] = useState(getApiBase())
  const [saved, setSaved] = useState(false)

  const save = () => {
    setApiBase(value)
    setSaved(true)
  }

  return (
    <main className="settings">
      <div className="settings-inner">
        <h1 className="settings-title">Settings</h1>

        <div>
          <label className="label" htmlFor="api-base">
            FFLogs proxy URL
          </label>
          <input
            id="api-base"
            className="input"
            type="text"
            spellCheck={false}
            autoComplete="off"
            placeholder="https://xivdiff-proxy.example.workers.dev"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setSaved(false)
            }}
          />
          <p className="helper">
            FFLogs credentials must stay server-side, so requests are routed
            through a small worker. The build ships with a default; override it
            here to point at your own deployment. Leave blank to restore the
            default.
          </p>
        </div>

        <div className="settings-actions">
          <button type="button" className="btn btn-primary" onClick={save}>
            {saved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/')}
          >
            Back
          </button>
        </div>
      </div>
    </main>
  )
}
