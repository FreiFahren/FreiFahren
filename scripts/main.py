import subprocess
import sys
from pathlib import Path

# Define the directory where this script and the target scripts reside
SCRIPT_DIR = Path(__file__).parent

# Define the sequence of scripts to run
SCRIPTS_TO_RUN = [
    "create_stations_list.py",
    "create_lines_list.py",
    "create_segments.py",
    "create_stations_map.py",
]

# Define expected output files for user information (relative to SCRIPT_DIR)
# This helps inform the user what they might want to check/modify
OUTPUT_FILES = {
    "create_stations_list.py": ["StationsList.json"],
    "create_lines_list.py": ["LinesList.json"],
    "create_segments.py": ["Segments.json"],
    "create_stations_map.py": ["stationsMap.json", "stationsMap.prod.json"],
}


def run_script(script_name: str, args: list[str] | None = None) -> bool:
    """Runs a given script using the same Python interpreter and waits for it."""
    script_path = SCRIPT_DIR / script_name
    if not script_path.is_file():
        print(f"Error: Script not found at {script_path}", file=sys.stderr)
        return False

    print(f"--- Running {script_name} ---")
    try:
        # Build the command, including optional arguments
        command = [sys.executable, str(script_path)]
        if args:
            command.extend(args)

        # Use sys.executable to ensure the same Python environment is used
        process = subprocess.run(
            command,
            check=True,  # Raise an exception if the script returns a non-zero exit code
            capture_output=True,
            text=True,
            cwd=SCRIPT_DIR,  # Run the script from its own directory
        )
        print(f"--- Output from {script_name}: ---")
        print(process.stdout)
        if process.stderr:
            print(f"--- Errors/Warnings from {script_name}: ---", file=sys.stderr)
            print(process.stderr, file=sys.stderr)
        print(f"--- Finished {script_name} ---")
        return True
    except FileNotFoundError:
        print(
            f"Error: Python interpreter '{sys.executable}' not found?", file=sys.stderr
        )
        return False
    except subprocess.CalledProcessError as e:
        print(
            f"Error: {script_name} failed with exit code {e.returncode}",
            file=sys.stderr,
        )
        print(f"--- Output from {script_name}: ---", file=sys.stderr)
        print(e.stdout, file=sys.stderr)
        print(f"--- Errors from {script_name}: ---", file=sys.stderr)
        print(e.stderr, file=sys.stderr)
        return False
    except Exception as e:
        print(
            f"An unexpected error occurred while running {script_name}: {e}",
            file=sys.stderr,
        )
        return False


def main():
    """
    This is the main function that runs the data processing pipeline.
    Which will allow to create the necessary data to setup FreiFahren.
    Executes the scripts sequentially with user prompts.
    """
    print("Starting the data processing pipeline...")
    print(f"Scripts will be run from: {SCRIPT_DIR}")

    for script in SCRIPTS_TO_RUN:
        if run_script(script):
            outputs = OUTPUT_FILES.get(script, [])
            output_str = ", ".join(outputs) if outputs else "files"
            print(f"\nSUCCESS: {script} completed.")
            if script != SCRIPTS_TO_RUN[-1]:  # Don't prompt after the last script
                try:
                    input(
                        f"You can now review/modify the {output_str}. Press Enter to continue to the next step..."
                    )
                except (
                    EOFError
                ):  # Handle cases where input is not available (e.g., automated environments)
                    print("\nSkipping pause as no input is available. Continuing...")

        else:
            print(
                f"\nFAILURE: {script} failed. Stopping the pipeline.", file=sys.stderr
            )
            sys.exit(1)  # Exit with a non-zero code to indicate failure

    print("\nMain pipeline finished successfully!")

    # --- Optional Post-processing Step ---
    last_script = SCRIPTS_TO_RUN[-1]
    if last_script == "create_stations_map.py":
        try:
            run_post_process = (
                input(
                    "\nDo you want to run the post-processing step for stationsMap.json? (y/N): "
                )
                .strip()
                .lower()
            )
            if run_post_process == "y" or run_post_process == "yes":
                print("--- Running create_stations_map.py post-process ---")
                if run_script("create_stations_map.py", args=["post-process"]):
                    print("\nSUCCESS: Post-processing completed.")
                    print("Expected output: stationsMap.prod.json")
                else:
                    print("\nFAILURE: Post-processing failed.", file=sys.stderr)
                    sys.exit(1)
            else:
                print("Skipping post-processing step.")
        except EOFError:
            print("\nSkipping post-processing prompt as no input is available.")

    print("\nPipeline finished!")


if __name__ == "__main__":
    main()
