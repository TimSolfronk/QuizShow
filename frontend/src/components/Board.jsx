import { formatMoney } from '../format'

const VALUES = [100, 200, 300, 400, 500]

export default function Board({ board, used, onOpen, onReset }) {
  if (!board) {
    return (
      <main className="board-wrap">
        <div className="empty-state">
          <h2>No question set loaded</h2>
          <p>Choose a question file to start the game. This resets all scores and questions.</p>
          <button className="btn primary" onClick={onReset}>
            Load question set
          </button>
        </div>
      </main>
    )
  }

  const usedSet = new Set(used)

  return (
    <main className="board-wrap">
      <div className="board-header">
        <h1 className="board-title">{board.title}</h1>
        <button className="btn" onClick={onReset}>
          Reset board…
        </button>
      </div>

      <div className="board">
        {board.categories.map(cat => (
          <div className="cat-header" key={cat}>
            {cat}
          </div>
        ))}

        {VALUES.map(value =>
          board.categories.map((cat, ci) => {
            const q = board.questions.find(q => q.category === ci && q.value === value)
            const isUsed = usedSet.has(q.id)
            return (
              <button
                key={q.id}
                className={`cell ${isUsed ? 'used' : ''}`}
                disabled={isUsed}
                onClick={() => onOpen(q)}
              >
                {formatMoney(value)}
              </button>
            )
          }),
        )}
      </div>
    </main>
  )
}
