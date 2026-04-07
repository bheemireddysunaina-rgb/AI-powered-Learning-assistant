"""
LearnFlow API: serves the static site and POST /api/chat (Gemini 2.5 Flash).

Run from this folder:
  pip install -r requirements.txt
  copy .env.example .env   # then add GEMINI_API_KEY
  uvicorn app:app --reload --host 127.0.0.1 --port 8000

Open http://127.0.0.1:8000/ — do not open HTML via file:// or API calls will fail.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from starlette.staticfiles import StaticFiles

load_dotenv()

ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

SYSTEM_INSTRUCTION = """You are LearnFlow, a patient and encouraging AI learning tutor for students.
You explain concepts clearly, use examples when helpful, and ask short check-for-understanding questions.
If the learner seems stuck, break ideas into smaller steps. Stay concise unless they ask to go deeper.
Do not pretend to know private data about the user; you only see this chat."""

_MAX_TURNS = 24


class ChatMessage(BaseModel):
    role: str = Field(..., description="user | assistant | model")
    text: str = Field(..., min_length=1, max_length=12000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=_MAX_TURNS)


def _get_client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Server missing GEMINI_API_KEY. Copy .env.example to .env and add your key.",
        )
    return genai.Client(api_key=GEMINI_API_KEY)


def _to_gemini_role(role: str) -> str:
    r = role.lower().strip()
    if r in ("assistant", "model"):
        return "model"
    return "user"


def _build_contents(messages: list[ChatMessage]) -> list[types.Content]:
    out: list[types.Content] = []
    for m in messages[-_MAX_TURNS:]:
        out.append(
            types.Content(
                role=_to_gemini_role(m.role),
                parts=[types.Part(text=m.text)],
            )
        )
    if not out or out[-1].role != "user":
        raise HTTPException(status_code=400, detail="Last message must be from the user.")
    return out


def _extract_text(response: types.GenerateContentResponse) -> str:
    try:
        t = response.text
        if t and t.strip():
            return t.strip()
    except Exception:
        pass
    if response.candidates:
        parts = response.candidates[0].content.parts
        texts = [p.text for p in parts if getattr(p, "text", None)]
        if texts:
            return "\n".join(texts).strip()
    return "I could not produce a reply (content may have been blocked). Try rephrasing your question."


app = FastAPI(title="LearnFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "model": GEMINI_MODEL,
        "api_key_configured": bool(GEMINI_API_KEY),
    }


@app.post("/api/chat")
def chat(body: ChatRequest):
    client = _get_client()
    contents = _build_contents(body.messages)
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0.7,
        max_output_tokens=2048,
    )
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=config,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {e!s}") from e

    return {"role": "assistant", "text": _extract_text(response)}


if not PUBLIC_DIR.is_dir():
    raise RuntimeError(f"Missing {PUBLIC_DIR}: create the public/ folder with index.html and assets.")

app.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=True), name="site")
