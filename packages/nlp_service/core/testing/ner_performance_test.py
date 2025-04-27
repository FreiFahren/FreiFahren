import unittest
import re
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from ner_test_cases import test_cases
from nlp_service.core.NER.TransportInformationRecognizer import TransportInformationRecognizer


class CustomTestResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.passed_tests = 0

    def addSuccess(self, test):
        super().addSuccess(test)
        self.passed_tests += 1

    def percentage_passed(self):
        total_tests = self.passed_tests + len(self.failures) + len(self.errors)
        return 100.0 * self.passed_tests / total_tests if total_tests > 0 else 100.0


class CustomTestRunner(unittest.TextTestRunner):
    def _makeResult(self):
        return CustomTestResult(self.stream, self.descriptions, self.verbosity)

    def run(self, test):
        result = super().run(test)
        percentage_passed = result.percentage_passed()

        bar_length = 20
        filled_length = int(bar_length * percentage_passed / 100)
        bar = '█' * filled_length + '-' * (bar_length - filled_length)

        print(f'\nPercentage of passed tests: {percentage_passed:.2f}% [{bar}]')
        return result


class TestTransportInformationRecognizerIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text_processor = TransportInformationRecognizer('models/loss17')

    @staticmethod
    def preprocess_station_name(station_name):
        # Remove punctuation and strip spaces
        return re.sub(r'\W+', '', station_name).strip()

    @staticmethod
    def generate_test_case(text, expected_stations):
        def test(self):
            result = self.text_processor.process_text(text)
            # Preprocess both expected and result lists
            preprocessed_result = [
                TestTransportInformationRecognizerIntegration.preprocess_station_name(station)
                for station in result
            ]
            preprocessed_expected = [
                TestTransportInformationRecognizerIntegration.preprocess_station_name(station)
                for station in expected_stations
            ]
            self.assertEqual(preprocessed_result, preprocessed_expected)
        return test


def generate_tests():
    for i, (text, expected_stations) in enumerate(test_cases, start=1):
        test_method = TestTransportInformationRecognizerIntegration.generate_test_case(
            text,
            expected_stations
        )
        test_method_name = f'test_station_extraction_{i}'
        setattr(TestTransportInformationRecognizerIntegration, test_method_name, test_method)


generate_tests()

if __name__ == '__main__':
    unittest.main(testRunner=CustomTestRunner())
