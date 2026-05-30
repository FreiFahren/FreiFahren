"""Pure-Python coverage of the spam classifier.

The inbound integration tests already exercise the classifier end-to-end; this
file adds direct coverage for boundaries and ham cases that don't need the
backend stack to run.
"""
from __future__ import annotations

import pytest

from telegram_bot.spam import MAX_EMOJIS, MAXIMUM_MESSAGE_LENGTH, MINIMUM_MESSAGE_LENGTH, is_spam


@pytest.mark.parametrize(
    ('label', 'text'),
    [
        ('typical_report', 'U2 alex 2x BOS'),
        ('short_but_valid', 'a' * MINIMUM_MESSAGE_LENGTH),
        ('long_but_valid', 'a' * MAXIMUM_MESSAGE_LENGTH),
        ('emoji_at_threshold', 'report ' + '😀' * MAX_EMOJIS),
    ],
)
def test_ham_messages_are_not_spam(label: str, text: str) -> None:
    assert not is_spam(text), f'expected {label!r} to pass'


@pytest.mark.parametrize(
    ('label', 'text'),
    [
        ('empty', ''),
        ('one_char', 'a'),
        ('below_minimum', 'a' * (MINIMUM_MESSAGE_LENGTH - 1)),
        ('above_maximum', 'a' * (MAXIMUM_MESSAGE_LENGTH + 1)),
        ('contains_question_mark', 'kontrolleur?'),
        ('contains_http', 'see http://example.com'),
        ('contains_https', 'see https://example.com'),
        ('too_many_emojis', '😀' * (MAX_EMOJIS + 1)),
    ],
)
def test_spam_messages_are_flagged(label: str, text: str) -> None:
    assert is_spam(text), f'expected {label!r} to be flagged'
