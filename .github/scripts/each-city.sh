#!/usr/bin/env bash
# Runs a command once per city, several cities at a time, and prints each city's output as one log
# group. Every city has a database of its own, so their migrations, seeds and report copies don't
# have to wait for each other. `{}` in the command stands for the city.
#
#   each-city.sh <cities at a time> "<city> <city> ..." <command> [<argument> ...]
#
# Every city runs even when another one fails; the exit status says whether all of them passed.
set -uo pipefail

limit=$1
cities=$2
shift 2

logs=$(mktemp -d)
declare -A pids
for city in $cities; do
    while [ "$(jobs -rp | wc -l)" -ge "$limit" ]; do
        wait -n || true
    done
    "${@//\{\}/$city}" > "$logs/$city.log" 2>&1 &
    pids[$city]=$!
done

status=0
for city in $cities; do
    if wait "${pids[$city]}"; then
        echo "::group::$city"
    else
        echo "::error::$city failed"
        echo "::group::$city (failed)"
        status=1
    fi
    cat "$logs/$city.log"
    echo "::endgroup::"
done
exit "$status"
