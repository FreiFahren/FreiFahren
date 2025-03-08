import unittest
from nlp_service.FreiFahren_BE_NLP.process_message import remove_direction_and_keyword


class TestRemoveDirectionAndKeyword(unittest.TestCase):

    def test_remove_direction_and_keyword_present(self):
        text = 'Kontrolle Schönleinstraße U8 richtung hermannstraße schwartze-blaue veste'
        direction_keyword = 'richtung'
        direction = 'hermannstraße'
        expected = 'Kontrolle Schönleinstraße U8  schwartze-blaue veste'
        self.assertEqual(remove_direction_and_keyword(text, direction_keyword, direction), expected)

    def test_no_direction_keyword_present(self):
        text = 'U8 just stopped at Alexanderplatz'
        direction_keyword = 'towards'
        direction = 'Hermannplatz'
        expected = text  # Expect no change
        self.assertEqual(remove_direction_and_keyword(text, direction_keyword, direction), expected)

    def test_direction_part_of_another_word(self):
        text = 'Schönlein jetzt Richtung Hermanplatz2 Typen eingestiegen'
        direction_keyword = 'Richtung'
        direction = 'Hermanplatz'
        expected = 'Schönlein jetzt 2 Typen eingestiegen'  # check if it removes parts of other word
        self.assertEqual(remove_direction_and_keyword(text, direction_keyword, direction), expected)

    def test_remove_direction_and_keyword_multiple_occurrences(self):
        text = 'U8 richtung Hermannplatz richtung Hermannplatz'
        direction_keyword = 'richtung'
        direction = 'Hermannplatz'
        expected = 'U8'
        self.assertEqual(remove_direction_and_keyword(text, direction_keyword, direction), expected)

    def test_remove_direction_and_keyword_no_direction(self):
        text = 'U8 richtung '
        direction_keyword = 'richtung'
        direction = 'Hermannplatz'
        expected = 'U8'
        self.assertEqual(remove_direction_and_keyword(text, direction_keyword, direction), expected)

    def test_remove_direction_and_keyword_empty_string(self):
        text = ''
        direction_keyword = 'richtung'
        direction = 'Hermannplatz'
        expected = ''
        self.assertEqual(remove_direction_and_keyword(text, direction_keyword, direction), expected)


if __name__ == '__main__':
    unittest.main()
