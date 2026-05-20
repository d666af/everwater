"""Phone normalization helpers — canonical Uzbek format +998XXXXXXXXX."""


def normalize_phone(raw) -> str | None:
    """Return canonical form +998 + last 9 digits, or None if unusable."""
    if not raw:
        return None
    digits = "".join(c for c in str(raw) if c.isdigit())
    if len(digits) < 9:
        s = str(raw).strip()
        return s or None
    return "+998" + digits[-9:]


def phone_digits_col(col):
    """SQLAlchemy expression: strip non-digits from a phone column for fuzzy matching."""
    from sqlalchemy import func
    return func.regexp_replace(col, "[^0-9]", "", "g")
