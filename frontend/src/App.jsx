import { useEffect, useState } from 'react'
import { getGame, postJSON } from './api'
import TopBar from './components/TopBar'
import Board from './components/Board'
import QuestionView from './components/QuestionView'
import ResetModal from './components/ResetModal'

export default function App() {
  const [game, setGame] = useState(null)
  const [view, setView] = useState({ name: 'board' })
  const [resetOpen, setResetOpen] = useState(false)
  const [error, setError] = useState(null)
  const [celebration, setCelebration] = useState(null)
  const [wrongFlash, setWrongFlash] = useState(null)

  useEffect(() => {
    getGame()
      .then(setGame)
      .catch(err => setError(`Could not reach the server: ${err.message}`))
  }, [])

  // Wraps an action so that failures surface as a dismissible banner.
  const guard = async (fn) => {
    try {
      setError(null)
      return await fn()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!game) {
    return <div className="loading">{error ?? 'Loading…'}</div>
  }

  const { board, state, files } = game

  const openQuestion = (q) => guard(async () => {
    const res = await postJSON(`/api/questions/${q.id}/use`)
    setGame(g => ({ ...g, state: res.state }))
    setView({ name: 'question', question: q })
  })

  const backToBoard = () => guard(async () => {
    setView({ name: 'board' })
    setGame(await getGame())
  })

  const answer = (teamId, correct) => guard(async () => {
    const res = await postJSON(`/api/questions/${view.question.id}/answer`, {
      team_id: teamId,
      correct,
    })
    setGame(g => ({ ...g, state: res.state }))
    if (correct) {
      const key = Date.now()
      setCelebration({ teamId, key })
      setTimeout(() => {
        setCelebration(c => (c && c.key === key ? null : c))
      }, 1300)
    } else {
      const key = Date.now()
      setWrongFlash({ teamId, key })
      setTimeout(() => {
        setWrongFlash(f => (f && f.key === key ? null : f))
      }, 900)
    }
  })

  const addTeam = () => guard(async () => {
    const res = await postJSON('/api/teams/add')
    setGame(g => ({ ...g, state: res.state }))
  })

  const removeTeam = (id) => guard(async () => {
    const res = await postJSON(`/api/teams/${id}/remove`)
    setGame(g => ({ ...g, state: res.state }))
  })

  const renameTeam = (id, name) => guard(async () => {
    const res = await postJSON(`/api/teams/${id}/rename`, { name })
    setGame(g => ({ ...g, state: res.state }))
  })

  const giveBoard = (id) => guard(async () => {
    const res = await postJSON(`/api/teams/${id}/board`)
    setGame(g => ({ ...g, state: res.state }))
  })

  const confirmReset = (fileId) => guard(async () => {
    const payload = await postJSON('/api/reset', { file_id: fileId })
    setGame(payload)
    setResetOpen(false)
    setView({ name: 'board' })
  })

  return (
    <div className="app">
      <TopBar
        teams={state.teams}
        boardTeamId={state.board_team_id}
        celebration={celebration}
        wrongFlash={wrongFlash}
        onAdd={addTeam}
        onRemove={removeTeam}
        onRename={renameTeam}
        onGiveBoard={giveBoard}
      />

      {error && (
        <div className="error-banner" onClick={() => setError(null)}>
          {error} <span className="dismiss">(click to dismiss)</span>
        </div>
      )}

      {view.name === 'board' ? (
        <Board
          board={board}
          used={state.used}
          onOpen={openQuestion}
          onReset={() => setResetOpen(true)}
        />
      ) : (
        <QuestionView
          question={view.question}
          board={board}
          teams={state.teams}
          onAnswer={answer}
          onBack={backToBoard}
        />
      )}

      {resetOpen && (
        <ResetModal
          files={files}
          currentFileId={state.file_id}
          onCancel={() => setResetOpen(false)}
          onConfirm={confirmReset}
        />
      )}
    </div>
  )
}
