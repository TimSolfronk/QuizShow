import { useState } from 'react'
import { formatMoney } from '../format'

const PARTY_COLORS = ['#f5b40a', '#34d399', '#60a5fa', '#f87171', '#c084fc', '#f472b6']

// A little confetti burst of colored particles plus a 🎉, rendered when a
// team's answer was marked right.
function PartyBurst() {
  const particles = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2
    const dist = 45 + Math.random() * 45
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 25,
      color: PARTY_COLORS[i % PARTY_COLORS.length],
      size: 6 + Math.random() * 6,
      delay: Math.random() * 0.15,
    }
  })

  return (
    <div className="party-burst" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className="particle"
          style={{
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            '--size': `${p.size}px`,
            '--delay': `${p.delay}s`,
            background: p.color,
          }}
        />
      ))}
      <span className="party-emoji">🎉</span>
    </div>
  )
}

export default function QuestionView({ question, board, teams, onAnswer, onBack }) {
  const [hintShown, setHintShown] = useState(false)
  const [solutionShown, setSolutionShown] = useState(false)
  const [rightTeams, setRightTeams] = useState(() => new Set())
  const [closing, setClosing] = useState(false)
  const [flashingTeams, setFlashingTeams] = useState({})

  const category = board.categories[question.category]
  const solutionRevealed = solutionShown || rightTeams.size > 0

  // Pictures can be URLs/data URIs or files inside the questions folder,
  // which the backend serves under /api/pictures/.
  const pictureSrc = question.picture
    ? (/^(https?:|data:)/i.test(question.picture)
        ? question.picture
        : '/api/pictures/' + question.picture.split('/').map(encodeURIComponent).join('/'))
    : null

  // Brief red flash on the team's card here (mirrors the top bar effect).
  const handleWrong = (teamId) => {
    const key = Date.now()
    setFlashingTeams(prev => ({ ...prev, [teamId]: key }))
    setTimeout(() => {
      setFlashingTeams(prev => {
        if (prev[teamId] !== key) return prev
        const next = { ...prev }
        delete next[teamId]
        return next
      })
    }, 900)
    onAnswer(teamId, false)
  }

  // Start the flip-out animation; the actual view switch happens in
  // handleFlipEnd once the animation has finished.
  const handleClose = () => {
    if (!closing) setClosing(true)
  }

  const handleFlipEnd = (e) => {
    if (
      e.target === e.currentTarget &&
      e.animationName === 'card-flip-out'
    ) {
      onBack()
    }
  }

  const markRight = (teamId) => {
    if (rightTeams.has(teamId)) return
    setRightTeams(prev => {
      const next = new Set(prev)
      next.add(teamId)
      return next
    })
    onAnswer(teamId, true)
  }

  return (
    <main className="question-wrap">
      <div className="flip-scene">
        <div className={`flip-inner ${closing ? 'closing' : ''}`} onAnimationEnd={handleFlipEnd}>
          <div className="question-card flip-front">
            <div className="question-top">
              <button className="btn" onClick={handleClose} disabled={closing}>
                ← Back to board
              </button>
              <div className="question-meta">
                {category} · {formatMoney(question.value)}
              </div>
            </div>

            {pictureSrc ? (
              <div className="question-media-row">
                <p className="question-text">{question.question}</p>
                <img className="question-picture" src={pictureSrc} alt="Question picture" />
              </div>
            ) : (
              <p className="question-text">{question.question}</p>
            )}

            <div className="question-actions">
              <button className="btn" disabled={hintShown} onClick={() => setHintShown(true)}>
                Show hint
              </button>
              <button className="btn" disabled={solutionRevealed} onClick={() => setSolutionShown(true)}>
                Show solution
              </button>
            </div>

            {hintShown && (
              <div className="hint-box">
                <span className="label">Hint</span>
                {question.hint}
              </div>
            )}

            {solutionRevealed && (
              <div className="solution-box">
                <span className="label">Solution</span>
                {question.solution}
              </div>
            )}

            <div className="answer-teams">
              <div className="answer-title">Who got it?</div>
              <div className="answer-teams-row">
                {teams.map(team => {
                  const isRight = rightTeams.has(team.id)
                  return (
                    <div className={`answer-col ${isRight ? 'right' : ''} ${flashingTeams[team.id] ? 'flash-wrong' : ''}`} key={team.id}>
                      <span className="answer-team-name">{team.name}</span>
                      <div className="answer-buttons">
                        <button
                          className="btn wrong"
                          title={`Wrong −${formatMoney(question.value)}`}
                          disabled={isRight}
                          onClick={() => handleWrong(team.id)}
                        >
                          ✕
                        </button>
                        <button
                          className="btn right"
                          title={`Right +${formatMoney(question.value)}`}
                          disabled={isRight}
                          onClick={() => markRight(team.id)}
                        >
                          ✓
                        </button>
                      </div>
                      {isRight && <span className="answer-note">✓ correct</span>}
                      {isRight && <PartyBurst />}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flip-back">
            <div className="flip-back-category">{category}</div>
            <div className="flip-back-value">{formatMoney(question.value)}</div>
            <div className="flip-back-brand">IN Quiz</div>
          </div>
        </div>
      </div>
    </main>
  )
}
