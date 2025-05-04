import json
import os
import re
from collections import OrderedDict
from typing import List, Dict, Any, Set, Tuple


def _handle_strasse(
    station_name: str, name_lower: str, synonyms: Set[str]
) -> Tuple[bool, str]:
    """Handles Straße/Strasse variations. Returns (matched, base_name).

    Example:
        station_name = "Afrikanische Straße"
        synonyms = set()
        _handle_strasse(station_name, station_name.lower(), synonyms)
        # synonyms: {'Afrikanische', 'Afrikanische Str.', 'Afrikanische Strasse'}
    """
    base = ""
    matched = False
    has_space = False
    if name_lower.endswith("straße"):
        base = station_name[:-6].strip()
        matched = True
        has_space = station_name[:-6].endswith(" ")
    elif name_lower.endswith(" strasse"):
        base = station_name[:-8].strip()
        matched = True
        has_space = True
    elif name_lower.endswith("strasse") and not name_lower.endswith(" strasse"):
        base = station_name[:-7].strip()
        matched = True
        has_space = station_name[:-7].endswith(" ")

    if matched and base:
        synonyms.add(base)
        if has_space:
            synonyms.add(f"{base} Str.")
            synonyms.add(f"{base} Strasse")
        else:
            synonyms.add(f"{base}str.")
            synonyms.add(f"{base}strasse")
    return matched, base


def _handle_platz(
    station_name: str, name_lower: str, synonyms: Set[str]
) -> Tuple[bool, str]:
    """Handles Platz variations. Returns (matched, base_name).

    Example:
        station_name = "Marienplatz"
        synonyms = set()
        _handle_platz(station_name, station_name.lower(), synonyms)
        # synonyms: {'Marienplz'}
    """
    base = ""
    matched = False
    if name_lower.endswith(" platz"):
        base = station_name[:-6].strip()
        matched = True
    elif name_lower.endswith("platz") and not name_lower.endswith(" platz"):
        base = station_name[:-5].strip()
        matched = True

    if matched and base:
        if len(base) > 2 or " " in base:
            synonyms.add(base)
        synonyms.add(f"{base}plz")
    return matched, base


def _handle_allee(
    station_name: str, name_lower: str, synonyms: Set[str]
) -> Tuple[bool, str]:
    """Handles Allee variations. Returns (matched, base_name).

    Example:
        station_name = "Grünbergallee"
        synonyms = set()
        _handle_allee(station_name, station_name.lower(), synonyms)
        # synonyms: {'Grünberg'}
    """
    base = ""
    matched = False
    if name_lower.endswith(" allee"):
        base = station_name[:-6].strip()
        matched = True
    elif name_lower.endswith("allee") and not name_lower.endswith(" allee"):
        base = station_name[:-5].strip()
        matched = True

    if matched and base:
        synonyms.add(base)
    return matched, base


def _handle_two_word_names(station_name: str, synonyms: Set[str]) -> None:
    """Handles two-word names, including the 'Am' prefix case.

    Examples:
        station_name = "Zwickauer Damm"
        synonyms = set()
        _handle_two_word_names(station_name, synonyms)
        # synonyms: {'Zwickauer'}

        station_name = "Am Wasserturm"
        synonyms = set()
        _handle_two_word_names(station_name, synonyms)
        # synonyms: {'Wasserturm'}
    """
    words = station_name.split()
    if len(words) == 2:
        first_word = words[0]
        second_word = words[1]
        if first_word.lower() == "am":
            if len(second_word) > 2:
                synonyms.add(second_word)
        elif len(first_word) > 2 and first_word.lower() not in ["alt", "neu"]:
            synonyms.add(first_word)


def generate_synonyms(station_name: str) -> List[str]:
    """
    Generates potential synonyms by applying various rules.
    """
    synonyms: Set[str] = set()
    original_name = station_name
    name_lower = station_name.lower()

    # Apply rules sequentially
    matched_strasse, _ = _handle_strasse(station_name, name_lower, synonyms)
    matched_platz, _ = _handle_platz(station_name, name_lower, synonyms)
    matched_allee, _ = _handle_allee(station_name, name_lower, synonyms)

    # Apply two-word rule only if others didn't match
    if not matched_strasse and not matched_platz and not matched_allee:
        _handle_two_word_names(station_name, synonyms)

    # Clean up
    synonyms.discard(original_name)
    final_synonyms = {s for s in synonyms if s}  # Remove empty strings

    # to make it easier to debug
    return sorted(list(final_synonyms))


def main():
    """
    Create synonyms for all stations in the StationsList.json file.
    Note: this is highly specific to german station names and will not work for other languages.
    """
    # Use __file__ if available, otherwise assume cwd is script dir
    script_dir = (
        os.path.dirname(os.path.abspath(__file__))
        if "__file__" in globals()
        else os.getcwd()
    )

    # Use script directory for input and output
    stations_list_path = os.path.join(
        script_dir, "StationsList.json"  # Read from script directory
    )
    synonyms_output_path = os.path.join(
        script_dir, "synonyms.json"  # Write to script directory
    )

    print(f"Reading stations from: {stations_list_path}")
    print(f"Writing generated synonyms to: {synonyms_output_path}")

    try:
        with open(stations_list_path, "r", encoding="utf-8") as f:
            stations_data: Dict[str, Dict[str, Any]] = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file not found at {stations_list_path}")
        exit(1)
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {stations_list_path}")
        exit(1)
    except Exception as e:
        print(f"An unexpected error occurred while reading the input file: {e}")
        exit(1)

    synonyms_map: Dict[str, List[str]] = {}

    if isinstance(stations_data, dict):
        for station_id, station_info in stations_data.items():

            # Skip stations that dont have metro lines (M, S, U) to avoid polluting the NLP with rarely used options
            # TODO: Account for tram-only stations in the future
            def has_metro_lines(station_info: Dict[str, Any]) -> bool:
                """Check if station has any metro lines (M, S, U)."""
                if not isinstance(station_info, dict) or "lines" not in station_info:
                    return False

                metro_prefixes = {"M", "S", "U"}
                return any(
                    line.startswith(prefix)
                    for prefix in metro_prefixes
                    for line in station_info["lines"]
                )

            if not has_metro_lines(station_info):
                continue

            if isinstance(station_info, dict) and "name" in station_info:
                station_name = station_info["name"]
                if station_name and isinstance(
                    station_name, str
                ):  # Ensure name is a non-empty string
                    synonyms_list = generate_synonyms(station_name)
                    synonyms_map[station_name] = (
                        synonyms_list  # Store even if list is empty
                    )
                else:
                    print(
                        f"Warning: Skipping station entry with ID '{station_id}' due to invalid or empty name."
                    )

            else:
                print(
                    f"Warning: Skipping invalid station entry format for ID: {station_id}"
                )
    else:
        print(
            f"Error: Expected a dictionary structure in {stations_list_path}, but found {type(stations_data)}"
        )
        exit(1)

    # Sort the final map by station name for consistent output
    # Use OrderedDict to maintain sort order before dumping to JSON
    sorted_synonyms_map = OrderedDict(sorted(synonyms_map.items()))

    try:
        # Ensure the output directory exists
        os.makedirs(os.path.dirname(synonyms_output_path), exist_ok=True)
        with open(synonyms_output_path, "w", encoding="utf-8") as f:
            json.dump(sorted_synonyms_map, f, ensure_ascii=False, indent=4)
        print(
            f"Successfully generated synonym entries for {len(sorted_synonyms_map)} stations."
        )
        print(f"Output written to: {synonyms_output_path}")

    except IOError as e:
        print(f"Error writing to output file {synonyms_output_path}: {e}")
        exit(1)
    except Exception as e:
        print(f"An unexpected error occurred while writing the output file: {e}")
        exit(1)


if __name__ == "__main__":
    main()
