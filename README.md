# Mogul Quiz

A local Jeopardy-style quiz board web app. Game master only — no fairness logic.

- **Board**: 5 categories × 5 value levels ($100–$500). Values only are shown on the board.
- **Teams**: 2–4 teams, each starting with $500. Names are editable in the top bar, which always shows all teams and their balances.
- **The board**: the team that last answered correctly "has the board" (👑 on their card) and picks the next question. Before the first question it belongs to the 1st team. The game master can give it to any team by clicking that team's crown icon.
- **Questions**: click a value to open the question screen. Wrong answers subtract and can be pressed repeatedly per team; a right answer adds once per team and reveals the solution (there is also a manual "Show solution" button). A "Show hint" button reveals the hint text.
- **Used questions**: every question you opened is greyed out on the board until the board is reset.
- **Reset**: the "Reset board…" button opens a dialog where you pick one of the available question files (JSON) from the `questions/` folder. This resets all scores to $500 and re-enables all questions; team count and names are kept.
- **Persistence**: all state (scores, names, used questions, loaded file) is saved to `data/state.json` after every change, so it survives restarts.

## Run

```bash
# 1. Backend (Python 3.10+)
pip install -r requirements.txt

# 2. Frontend (only needed the first time, or after changing frontend code)
cd frontend && npm install && npm run build && cd ..

# 3. Start
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Then open **http://127.0.0.1:8000** in your browser.

The backend serves the built React app from `frontend/dist`. If you change frontend code, rebuild it (`npm run build` in `frontend/`).

## Development mode (frontend hot reload)

```bash
# terminal 1: backend
python3 -m uvicorn backend.main:app --port 8000
# terminal 2: frontend dev server
cd frontend && npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies `/api` to the backend.

## Question files

Place JSON files in `questions/`. Format (exactly 5 categories, 5 questions each, values 100–500):

```json
{
  "title": "My Quiz",
  "categories": [
    {
      "name": "Category Name",
      "questions": [
        {
          "value": 100,
          "question": "Question text?",
          "hint": "Hint text.",
          "solution": "The solution.",
          "picture": "pictures/my_image.png"
        }
      ]
    }
  ]
}
```

The optional `picture` field can be either a path to an image file inside the `questions/` folder (recommended: put them in `questions/pictures/`, any of .png/.jpg/.jpeg/.gif/.webp/.svg/.bmp) or a full URL / data URI. If set, the picture is displayed on the question card to the right of the question text. A picture path that doesn't exist is rejected when the file is loaded.

Two sample sets are included: `general_knowledge.json` and `movies_music.json`.

## Project layout

```
backend/main.py      FastAPI app (REST API under /api, serves frontend/dist)
frontend/            React + Vite app
frontend/dist/       Built frontend (served by FastAPI)
questions/           Question sets (JSON)
data/state.json      Game state (auto-created)
```
