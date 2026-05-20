"""Phone normalization helpers — canonical Uzbek format +998XXXXXXXXX."""


def normalize_phone(raw) -> str | None:
    """Return canonical form +998 + last 9 digits, or None if unusable.

    Accepts any input shape (with spaces, +, 8/0 prefixes). When fewer than
    9 digits are present the trimmed original is returned so we never lose data.
    """
    if not raw:
        return None
    digits = "".join(c for c in str(raw) if c.isdigit())
    if len(digits) < 9:
        s = str(raw).strip()
        return s or None
    return "+998" + digits[-9:]
