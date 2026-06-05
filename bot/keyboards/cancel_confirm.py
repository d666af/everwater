"""In-place cancel confirmation helpers.

Instead of sending a separate confirmation message, the cancel button is
swapped — within the SAME message keyboard — into a
"✅ Подтвердить отмену" + "↩️ Нет" pair. Tapping "Нет" restores the original
cancel button. Other buttons in the keyboard are preserved.
"""
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

CONFIRM_TEXT = "✅ Подтвердить отмену"
NO_TEXT = "↩️ Нет"


def to_confirm_markup(markup, cancel_cb: str, yes_cb: str, no_cb: str) -> InlineKeyboardMarkup:
    """Replace the cancel button (callback == cancel_cb) with confirm + no buttons."""
    base = markup.inline_keyboard if markup else []
    rows, found = [], False
    for row in base:
        new_row = []
        for b in row:
            if b.callback_data == cancel_cb:
                found = True
                new_row.append(InlineKeyboardButton(text=CONFIRM_TEXT, callback_data=yes_cb))
                new_row.append(InlineKeyboardButton(text=NO_TEXT, callback_data=no_cb))
            else:
                new_row.append(b)
        rows.append(new_row)
    if not found:
        rows.append([
            InlineKeyboardButton(text=CONFIRM_TEXT, callback_data=yes_cb),
            InlineKeyboardButton(text=NO_TEXT, callback_data=no_cb),
        ])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def to_cancel_markup(markup, yes_cb: str, no_cb: str, cancel_text: str, cancel_cb: str) -> InlineKeyboardMarkup:
    """Restore the original cancel button in place of the confirm + no pair."""
    base = markup.inline_keyboard if markup else []
    rows = []
    for row in base:
        new_row = []
        for b in row:
            if b.callback_data == yes_cb:
                new_row.append(InlineKeyboardButton(text=cancel_text, callback_data=cancel_cb))
            elif b.callback_data == no_cb:
                continue  # drop — already replaced by the restored cancel button
            else:
                new_row.append(b)
        if new_row:
            rows.append(new_row)
    return InlineKeyboardMarkup(inline_keyboard=rows)
