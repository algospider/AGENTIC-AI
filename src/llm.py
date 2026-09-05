"""Thin LLM client for OpenCode Zen (OpenAI-compatible) with graceful fallback."""

import json
import os
import urllib.request

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

BASE_URL = os.getenv("OPENAI_BASE_URL", "https://opencode.ai/zen/v1").rstrip("/")
API_KEY = os.getenv("OPENAI_API_KEY", "")
# Free-tier default on OpenCode Zen (verified working; others with -free suffix
# like nemotron-3.5-lightning-free also work but are reasoning-heavy).
MODEL_ID = os.getenv("MODEL_ID", "nemotron-3-ultra-free")


def is_configured() -> bool:
    return bool(API_KEY)


def _via_openai_lib(prompt: str, system: str, model: str, timeout: int) -> str | None:
    try:
        from openai import OpenAI  # type: ignore
    except Exception:
        return None
    try:
        client = OpenAI(api_key=API_KEY, base_url=BASE_URL)
        resp = client.chat.completions.create(
            model=model or MODEL_ID,
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=600,
            timeout=timeout,
        )
        if not resp.choices:
            print("[LLM] OpenAI-lib call returned no choices.")
            return None
        msg = resp.choices[0].message
        content = getattr(msg, "content", None) or ""
        # Some free models put the answer in reasoning when content is empty.
        if not content.strip():
            content = getattr(msg, "reasoning", None) or ""
        return content.strip() or None
    except Exception as e:
        print(f"[LLM] OpenAI-lib call failed: {e}")
        return None


def _via_urllib(prompt: str, system: str, model: str, timeout: int) -> str | None:
    try:
        payload = json.dumps({
            "model": model or MODEL_ID,
            "messages": [{"role": "system", "content": system},
                         {"role": "user", "content": prompt}],
            "temperature": 0.4,
            "max_tokens": 600,
        }).encode()
        req = urllib.request.Request(
            f"{BASE_URL}/chat/completions", data=payload,
            headers={"Content-Type": "application/json",
                     "Authorization": f"Bearer {API_KEY}"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode())
        return (data["choices"][0]["message"]["content"] or "").strip() or None
    except Exception as e:
        print(f"[LLM] HTTP fallback failed: {e}")
        return None


def complete(prompt: str, system: str = "You are a helpful financial advisor. Keep answers short, plain-English, no jargon.",
             model: str | None = None, timeout: int = 30) -> str | None:
    """Return LLM text or None if unconfigured/failed (caller must fallback)."""
    if not is_configured():
        print("[LLM] No OPENAI_API_KEY set — using rule-based fallback.")
        return None
    model = model or MODEL_ID
    # One retry: free-tier providers occasionally return a transient error.
    for attempt in (1, 2):
        text = _via_openai_lib(prompt, system, model, timeout)
        if text:
            return text
        if attempt == 1:
            print("[LLM] Retrying once...")
    return _via_urllib(prompt, system, model, timeout)
