"""Mogul Quiz - local quiz board game backend (FastAPI).

Serves the JSON REST API under /api and the built React frontend
(frontend/dist) at /.
"""

import json
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent
QUESTIONS_DIR = BASE_DIR / "questions"
DATA_DIR = BASE_DIR / "data"
STATE_FILE = DATA_DIR / "state.json"
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

NUM_CATEGORIES = 5
NUM_QUESTIONS = 5
REQUIRED_VALUES = [100, 200, 300, 400, 500]
STARTING_SCORE = 500
MIN_TEAMS = 2
MAX_TEAMS = 4
MAX_NAME_LENGTH = 40
PICTURE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}

_state_lock = threading.Lock()
_board_cache: dict[str, dict] = {}

app = FastAPI(title="Mogul Quiz", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------
# Question files
# --------------------------------------------------------------------------

def question_file_path(file_id: str) -> Path:
    if not file_id or "/" in file_id or "\\" in file_id or file_id.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid question file id")
    path = QUESTIONS_DIR / f"{file_id}.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"Question file '{file_id}' not found")
    return path


def load_board(file_id: str) -> dict:
    """Load and validate a question set. Results are cached per file id."""
    if file_id in _board_cache:
        return _board_cache[file_id]

    path = question_file_path(file_id)
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Question file '{file_id}' is not valid JSON: {exc}")

    categories = raw.get("categories")
    if not isinstance(categories, list) or len(categories) != NUM_CATEGORIES:
        raise HTTPException(
            status_code=500,
            detail=f"Question file '{file_id}' must contain exactly {NUM_CATEGORIES} categories",
        )

    questions = []
    category_names = []
    for ci, category in enumerate(categories):
        if not isinstance(category, dict) or not isinstance(category.get("name"), str) or not category["name"].strip():
            raise HTTPException(status_code=500, detail=f"Category #{ci + 1} in '{file_id}' has no valid name")
        category_names.append(category["name"].strip())

        cat_questions = category.get("questions")
        if not isinstance(cat_questions, list) or len(cat_questions) != NUM_QUESTIONS:
            raise HTTPException(
                status_code=500,
                detail=f"Category '{category_names[-1]}' in '{file_id}' must contain exactly {NUM_QUESTIONS} questions",
            )

        values = []
        for qi, q in enumerate(cat_questions):
            value = q.get("value")
            if value not in REQUIRED_VALUES:
                raise HTTPException(
                    status_code=500,
                    detail=f"Question #{qi + 1} in '{category_names[-1]}' has an invalid value "
                           f"({value!r}); expected one of {REQUIRED_VALUES}",
                )
            for field in ("question", "hint", "solution"):
                if not isinstance(q.get(field), str) or not q[field].strip():
                    raise HTTPException(
                        status_code=500,
                        detail=f"Question #{qi + 1} in '{category_names[-1]}' is missing the '{field}' field",
                    )
            picture = q.get("picture")
            if picture is not None:
                if not isinstance(picture, str) or not picture.strip():
                    raise HTTPException(
                        status_code=500,
                        detail=f"Question #{qi + 1} in '{category_names[-1]}' has an invalid 'picture' field",
                    )
                picture = picture.strip()
                # URLs/data URIs are used as-is; anything else must be a file
                # inside the questions folder.
                if not picture.lower().startswith(("http://", "https://", "data:")):
                    picture_path = (QUESTIONS_DIR / picture).resolve()
                    if (not picture_path.is_relative_to(QUESTIONS_DIR.resolve())
                            or not picture_path.is_file()):
                        raise HTTPException(
                            status_code=500,
                            detail=f"Question #{qi + 1} in '{category_names[-1]}' references picture "
                                   f"'{picture}' which was not found inside the questions folder",
                        )
            values.append(value)
            questions.append({
                "id": f"c{ci}-q{qi}",
                "category": ci,
                "value": value,
                "question": q["question"].strip(),
                "hint": q["hint"].strip(),
                "solution": q["solution"].strip(),
                "picture": picture,
            })

        if sorted(values) != REQUIRED_VALUES:
            raise HTTPException(
                status_code=500,
                detail=f"Category '{category_names[-1]}' in '{file_id}' must have one question "
                       f"for each value {REQUIRED_VALUES}",
            )

    board = {
        "id": file_id,
        "title": raw.get("title") or file_id.replace("_", " ").title(),
        "categories": category_names,
        "questions": questions,
    }
    _board_cache[file_id] = board
    return board


def list_question_files() -> list[dict]:
    files = []
    for path in sorted(QUESTIONS_DIR.glob("*.json")):
        try:
            title = json.loads(path.read_text(encoding="utf-8")).get("title")
        except Exception:
            title = None
        files.append({
            "id": path.stem,
            "name": title if isinstance(title, str) and title.strip() else path.stem.replace("_", " ").title(),
        })
    return files


# --------------------------------------------------------------------------
# Game state (persisted to data/state.json)
# --------------------------------------------------------------------------

def new_team(team_id: int) -> dict:
    return {"id": team_id, "name": f"Team {team_id}", "score": STARTING_SCORE}


def default_state() -> dict:
    return {
        "file_id": None,
        "teams": [new_team(1), new_team(2)],
        "next_team_id": 3,
        "used": [],
        "board_team_id": 1,
    }


def load_state() -> dict:
    if STATE_FILE.is_file():
        try:
            state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            if isinstance(state, dict) and isinstance(state.get("teams"), list):
                state.setdefault("used", [])
                state.setdefault("file_id", None)
                if not isinstance(state.get("next_team_id"), int):
                    state["next_team_id"] = max((t["id"] for t in state["teams"]), default=0) + 1
                team_ids = [t["id"] for t in state["teams"]]
                if state.get("board_team_id") not in team_ids:
                    state["board_team_id"] = team_ids[0] if team_ids else None
                return state
        except Exception:
            pass  # fall through to a fresh default state
    return default_state()


def save_state(state: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def game_payload(state: dict) -> dict:
    board = None
    if state.get("file_id"):
        try:
            board = load_board(state["file_id"])
        except HTTPException:
            board = None  # board file missing/invalid -> frontend asks for a new one
    return {"files": list_question_files(), "board": board, "state": state}


def find_question(board: dict, question_id: str) -> dict:
    for q in board["questions"]:
        if q["id"] == question_id:
            return q
    raise HTTPException(status_code=404, detail=f"Question '{question_id}' not found in the loaded board")


def find_team(state: dict, team_id: int) -> dict:
    for team in state["teams"]:
        if team["id"] == team_id:
            return team
    raise HTTPException(status_code=404, detail=f"Team {team_id} not found")


# --------------------------------------------------------------------------
# API models
# --------------------------------------------------------------------------

class ResetBody(BaseModel):
    file_id: str


class RenameBody(BaseModel):
    name: str = Field(min_length=1, max_length=MAX_NAME_LENGTH)


class AnswerBody(BaseModel):
    team_id: int
    correct: bool


# --------------------------------------------------------------------------
# API routes
# --------------------------------------------------------------------------

@app.get("/api/game")
def get_game():
    with _state_lock:
        state = load_state()
    return game_payload(state)


@app.post("/api/reset")
def reset_board(body: ResetBody):
    """Reset all scores and used questions and load the chosen question file.

    Team count and names are kept.
    """
    load_board(body.file_id)  # validates the file before touching the state
    with _state_lock:
        state = load_state()
        state["file_id"] = body.file_id
        state["used"] = []
        for team in state["teams"]:
            team["score"] = STARTING_SCORE
        state["board_team_id"] = state["teams"][0]["id"]  # fresh game -> 1st team
        save_state(state)
        return game_payload(state)


@app.post("/api/teams/add")
def add_team():
    with _state_lock:
        state = load_state()
        if len(state["teams"]) >= MAX_TEAMS:
            raise HTTPException(status_code=400, detail=f"A maximum of {MAX_TEAMS} teams is allowed")
        team = new_team(state["next_team_id"])
        state["next_team_id"] += 1
        state["teams"].append(team)
        save_state(state)
        return {"state": state}


@app.post("/api/teams/{team_id}/remove")
def remove_team(team_id: int):
    with _state_lock:
        state = load_state()
        if len(state["teams"]) <= MIN_TEAMS:
            raise HTTPException(status_code=400, detail=f"At least {MIN_TEAMS} teams are required")
        find_team(state, team_id)
        state["teams"] = [t for t in state["teams"] if t["id"] != team_id]
        if state.get("board_team_id") not in [t["id"] for t in state["teams"]]:
            state["board_team_id"] = state["teams"][0]["id"]
        save_state(state)
        return {"state": state}


@app.post("/api/teams/{team_id}/board")
def give_board(team_id: int):
    """Give 'the board' (right to pick the next question) to a team."""
    with _state_lock:
        state = load_state()
        team = find_team(state, team_id)
        state["board_team_id"] = team["id"]
        save_state(state)
        return {"state": state}


@app.post("/api/teams/{team_id}/rename")
def rename_team(team_id: int, body: RenameBody):
    with _state_lock:
        state = load_state()
        team = find_team(state, team_id)
        team["name"] = body.name.strip()[:MAX_NAME_LENGTH]
        save_state(state)
        return {"state": state}


@app.get("/api/pictures/{file_path:path}")
def get_picture(file_path: str):
    """Serve image files referenced by questions from inside the questions folder."""
    base = QUESTIONS_DIR.resolve()
    path = (QUESTIONS_DIR / file_path).resolve()
    if (not path.is_relative_to(base) or not path.is_file()
            or path.suffix.lower() not in PICTURE_EXTENSIONS):
        raise HTTPException(status_code=404, detail="Picture not found")
    return FileResponse(path)


@app.post("/api/questions/{question_id}/use")
def use_question(question_id: str):
    """Mark a question as opened (its button becomes greyed out on the board)."""
    with _state_lock:
        state = load_state()
        if not state.get("file_id"):
            raise HTTPException(status_code=400, detail="No question set is loaded")
        board = load_board(state["file_id"])
        find_question(board, question_id)
        if question_id not in state["used"]:
            state["used"].append(question_id)
            save_state(state)
        return {"state": state}


@app.post("/api/questions/{question_id}/answer")
def answer_question(question_id: str, body: AnswerBody):
    """Adjust a team's score by the question's value (correct: +, wrong: -)."""
    with _state_lock:
        state = load_state()
        if not state.get("file_id"):
            raise HTTPException(status_code=400, detail="No question set is loaded")
        board = load_board(state["file_id"])
        question = find_question(board, question_id)
        team = find_team(state, body.team_id)
        team["score"] += question["value"] if body.correct else -question["value"]
        if body.correct:
            # the team that last answered correctly takes the board
            state["board_team_id"] = team["id"]
        save_state(state)
        return {"state": state}


# --------------------------------------------------------------------------
# Frontend (built React app) - mounted last so /api routes take precedence
# --------------------------------------------------------------------------

if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {
            "message": "Frontend not built yet. Run: cd frontend && npm install && npm run build",
        }
