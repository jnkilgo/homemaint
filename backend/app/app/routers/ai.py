from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import json
import urllib.request
import urllib.error

from app.database import get_db
from app.auth import get_current_user, require_admin
from app.routers.settings import get_setting, set_setting
from app import models

router = APIRouter()

AI_SETTING_KEYS = [
    "ai_enabled", "ai_provider", "ai_model",
    "ai_anthropic_key", "ai_openai_key", "ai_ollama_url"
]

AI_DEFAULTS = {
    "ai_enabled":      "false",
    "ai_provider":     "openai",
    "ai_model":        "gpt-4o",
    "ai_anthropic_key": "",
    "ai_openai_key":   "",
    "ai_ollama_url":   "http://localhost:11434",
}


@router.get("/settings")
def get_ai_settings(db: Session = Depends(get_db), _=Depends(get_current_user)):
    def s(k): return get_setting(db, k) or AI_DEFAULTS.get(k, "")
    return {
        "ai_enabled":      s("ai_enabled") == "true",
        "ai_provider":     s("ai_provider"),
        "ai_model":        s("ai_model"),
        "ai_anthropic_key": "***" if s("ai_anthropic_key") else "",
        "ai_openai_key":   "***" if s("ai_openai_key") else "",
        "ai_ollama_url":   s("ai_ollama_url"),
    }


@router.put("/settings")
def update_ai_settings(data: dict, db: Session = Depends(get_db), _=Depends(require_admin)):
    if "ai_enabled" in data:
        set_setting(db, "ai_enabled", "true" if data["ai_enabled"] else "false")
    for k in ["ai_provider", "ai_model", "ai_ollama_url"]:
        if k in data:
            set_setting(db, k, str(data[k]))
    # Only update keys if not masked
    for k in ["ai_anthropic_key", "ai_openai_key"]:
        if k in data and data[k] and data[k] != "***":
            set_setting(db, k, str(data[k]))
    return get_ai_settings(db)


SUGGEST_PROMPT = """You are a home and property maintenance expert.
Given the asset details below, return a JSON array of recommended maintenance tasks.

Asset:
{context}

Return ONLY a valid JSON array. No markdown, no explanation. Each item must have:
- "name": string (task name)
- "description": string (brief details, specs, quantities)
- "interval_type": one of "days", "months", "hours", "miles", "seasonal" — DO NOT use "weeks" or "years", convert weeks to days and years to months
- "interval": integer
- "parts": array of objects with "name", "part_number" (or ""), "spec_notes" (or ""), "qty" (integer)

Example:
[
  {
    "name": "Oil Change",
    "description": "5W-30 full synthetic, 5qt with filter",
    "interval_type": "months",
    "interval": 6,
    "parts": [
      {"name": "Oil Filter", "part_number": "PH3593A", "spec_notes": "", "qty": 1},
      {"name": "Motor Oil 5W-30", "part_number": "", "spec_notes": "5W-30 full synthetic", "qty": 5}
    ]
  }
]"""


def _call_openai(api_key: str, model: str, prompt: str) -> str:
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())["choices"][0]["message"]["content"]


def _call_anthropic(api_key: str, model: str, prompt: str) -> str:
    payload = json.dumps({
        "model": model,
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())["content"][0]["text"]


def _call_ollama(base_url: str, model: str, prompt: str) -> str:
    payload = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
    }).encode()
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())["response"]


@router.post("/suggest")
def suggest_maintenance(data: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    def s(k): return get_setting(db, k) or AI_DEFAULTS.get(k, "")

    if s("ai_enabled") != "true":
        raise HTTPException(400, "AI assistant is not enabled")

    provider = s("ai_provider")
    model    = s("ai_model")

    # Build context string
    context_parts = []
    for field in ["name", "make", "model", "model_year", "category", "location", "description", "notes"]:
        if data.get(field):
            context_parts.append(f"{field}: {data[field]}")
    context = "\n".join(context_parts)

    prompt = SUGGEST_PROMPT.replace("{context}", context)

    try:
        if provider == "openai":
            key = s("ai_openai_key")
            if not key:
                raise HTTPException(400, "OpenAI API key not configured")
            raw = _call_openai(key, model, prompt)
        elif provider == "anthropic":
            key = s("ai_anthropic_key")
            if not key:
                raise HTTPException(400, "Anthropic API key not configured")
            raw = _call_anthropic(key, model, prompt)
        elif provider == "ollama":
            raw = _call_ollama(s("ai_ollama_url"), model, prompt)
        else:
            raise HTTPException(400, f"Unknown provider: {provider}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"AI provider error: {str(e)}")

    # Parse JSON from response
    try:
        # Strip markdown fences if present
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        suggestions = json.loads(text.strip())
        if not isinstance(suggestions, list):
            raise ValueError("Expected a list")
    except Exception as e:
        raise HTTPException(502, f"Failed to parse AI response: {str(e)}\nRaw: {raw[:500]}")

    # Normalize interval_type values
    type_map = {"weeks": "days", "years": "months", "year": "months", "week": "days", "month": "months", "day": "days", "hour": "hours", "mile": "miles"}
    interval_map = {"weeks": 7, "week": 7}  # multiplier for days
    for s in suggestions:
        raw = str(s.get("interval_type", "months")).lower()
        if raw == "weeks" or raw == "week":
            s["interval"] = (s.get("interval") or 1) * 7
        elif raw == "years" or raw == "year":
            s["interval"] = (s.get("interval") or 1) * 12
        s["interval_type"] = type_map.get(raw, raw if raw in ("days","months","hours","miles","seasonal") else "months")
    return {"suggestions": suggestions}
