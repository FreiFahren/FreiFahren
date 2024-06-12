import unittest
from process_message import check_for_spam


class TestCheckForSpam(unittest.TestCase):
    def test_long_text(self):
        self.assertTrue(check_for_spam('a' * 251))

    def test_contains_link(self):
        self.assertTrue(check_for_spam('Visit my website at http://example.com'))

    def test_many_emojis(self):
        self.assertTrue(check_for_spam('😀😀😀😀😀😀'))

    def test_no_spam(self):
        self.assertFalse(check_for_spam('This is a normal message.'))

    def test_mixed_conditions(self):
        # More than 5 emojis but less than 250 characters without a link
        self.assertTrue(check_for_spam('😀😀😀😀😀😀 Great day!'))

    def test_edge_case_length(self):
        # Exactly 250 characters should not be considered spam
        self.assertFalse(check_for_spam('a' * 250))

    def test_edge_case_emojis(self):
        # Exactly 5 emojis should not be considered spam
        self.assertFalse(check_for_spam('😀😀😀😀😀'))


if __name__ == '__main__':
    unittest.main()
