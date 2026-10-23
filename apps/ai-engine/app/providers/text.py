"""Normalización de texto en español para el proveedor de prueba."""

import re
import unicodedata

STOPWORDS = {
    "a", "al", "con", "de", "del", "el", "en", "es", "la", "las", "lo", "los", "o", "para",
    "por", "que", "se", "su", "sus", "un", "una", "y", "e", "u", "como", "entre", "sobre",
}  # fmt: skip


def tokens(text: str) -> list[str]:
    plain = unicodedata.normalize("NFD", text.lower())
    plain = "".join(c for c in plain if unicodedata.category(c) != "Mn")
    words = re.findall(r"[a-z0-9]+", plain)
    # Raíz muy simple: quita plurales para que "fracciones" y "fraccion" coincidan.
    return [
        w[:-2] if w.endswith("es") and len(w) > 4 else w.rstrip("s")
        for w in words
        if w not in STOPWORDS
    ]
