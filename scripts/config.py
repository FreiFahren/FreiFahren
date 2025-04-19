from typing import List

# which city are we querying?
CITY: str = "Berlin"

# what admin‑level regexp do we want? (usually 4–6 for a city boundary)
ADMIN_LEVEL: str = "^[4-6]$"

# which lines should be kept?
LINES: List[str] = [
    "S1",
    "S2",
    "S25",
    "S26",
    "S3",
    "S41",
    "S42",
    "S45",
    "S46",
    "S47",
    "S5",
    "S7",
    "S75",
    "S8",
    "S85",
    "S9",
    "U1",
    "U2",
    "U3",
    "U4",
    "U5",
    "U6",
    "U7",
    "U8",
    "U9",
    "M1",
    "M2",
    "M4",
    "M5",
    "M6",
    "M8",
    "M10",
    "M13",
    "M17",
    "12",
    "16",
    "18",
    "21",
    "27",
    "37",
    "50",
    "60",
    "61",
    "62",
    "63",
    "67",
    "68",
]
