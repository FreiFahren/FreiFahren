import math
from typing import Dict


def haversine(coord1: Dict[str, float], coord2: Dict[str, float]) -> float:
    """Compute the great-circle distance between two coordinate pairs in meters."""
    lat1, lon1 = math.radians(coord1["latitude"]), math.radians(coord1["longitude"])
    lat2, lon2 = math.radians(coord2["latitude"]), math.radians(coord2["longitude"])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    return 6371000 * c
