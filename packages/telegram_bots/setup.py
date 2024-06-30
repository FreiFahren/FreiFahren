from setuptools import setup, find_packages

setup(
    name="telegram_bots",
    version="0.1",
    packages=find_packages(),
    install_requires=[
        "pyTelegramBotAPI",
        "fuzzywuzzy",
        "python-Levenshtein",
        "python-dotenv",
        "numpy<2,>=1.26.0",
        "numpy<2,>=1.26.0",
        "watchdog",
        "spacy",
        "psycopg2-binary",
        "flask",
    ],
)

