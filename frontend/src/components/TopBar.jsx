import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../format'

// Animates from the previous value to `target` (ease-out) whenever it changes.
function useAnimatedNumber(target, duration = 700) {
  const [value, setValue] = useState(target)
  const currentRef = useRef(target)

  useEffect(() => {
    const from = currentRef.current
    if (from === target) return
    let raf
    const start = performance.now()
    const tick = now => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = Math.round(from + (target - from) * eased)
      currentRef.current = v
      setValue(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

function TeamScore({ value, celebrate }) {
  const display = useAnimatedNumber(value)
  const [pulse, setPulse] = useState(false)

  // celebrate is a "key" (timestamp) that changes whenever this team scored
  useEffect(() => {
    if (!celebrate) return
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 1200)
    return () => clearTimeout(t)
  }, [celebrate])

  return (
    <div className={`team-score ${value < 0 ? 'negative' : ''} ${pulse ? 'bump' : ''}`}>
      {formatMoney(display)}
    </div>
  )
}

export default function TopBar({ teams, boardTeamId, celebration, wrongFlash, onAdd, onRemove, onRename, onGiveBoard }) {
  const commitName = (team, e) => {
    const name = e.target.value.trim()
    if (!name) {
      e.target.value = team.name // don't allow empty names
      return
    }
    if (name !== team.name) onRename(team.id, name)
  }

  return (
    <header className="topbar">
      <div className="topbar-title">
        IN <span>Quiz</span>
      </div>
      <div className="teams">
        {teams.map(team => {
          const isCelebrating = celebration?.teamId === team.id
          const isFlashing = wrongFlash?.teamId === team.id
          const hasBoard = boardTeamId === team.id
          return (
            <div
              className={`team-card ${isCelebrating ? 'celebrate' : ''} ${isFlashing ? 'flash-wrong' : ''}`}
              key={team.id}
            >
              <button
                className={`board-crown ${hasBoard ? 'holder' : ''}`}
                title={hasBoard ? `${team.name} has the board` : `Give the board to ${team.name}`}
                onClick={() => !hasBoard && onGiveBoard(team.id)}
              >
                👑
              </button>
              {teams.length > 2 && (
                <button
                  className="team-remove"
                  title={`Remove ${team.name}`}
                  onClick={() => onRemove(team.id)}
                >
                  ×
                </button>
              )}
              <input
                className="team-name"
                defaultValue={team.name}
                maxLength={40}
                size={Math.max(6, team.name.length + 1)}
                onBlur={e => commitName(team, e)}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.target.blur()
                }}
              />
              <TeamScore
                value={team.score}
                celebrate={isCelebrating ? celebration.key : 0}
              />
            </div>
          )
        })}
        {teams.length < 4 && (
          <button className="add-team" onClick={onAdd}>
            + Add team
          </button>
        )}
      </div>
    </header>
  )
}
