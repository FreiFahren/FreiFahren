#!/usr/bin/env bash
# Runs a command once per city, several cities at a time, and prints each city's output as one log
# group. Every city has a database of its own, so their migrations, seeds and report copies don't
# have to wait for each other. `{}` in the command stands for the city.
#
#   each-city.sh <cities at a time> "<city> <city> ..." [--retry-on <log text>] <command> [<argument> ...]
#
# Every city runs even when another one fails; the exit status says whether all of them passed.
set -uo pipefail

limit=$1
cities=$2
shift 2
retry_on=''
if [[ ${1:-} == --retry-on ]]; then
    retry_on=$2
    shift 2
fi

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
retry_cities=()
for city in $cities; do
    if wait "${pids[$city]}"; then
        echo "::group::$city"
    elif [[ -n "$retry_on" ]] && grep -Fq -- "$retry_on" "$logs/$city.log"; then
        retry_cities+=("$city")
        echo "::group::$city (retry scheduled)"
    else
        echo "::error::$city failed"
        echo "::group::$city (failed)"
        status=1
    fi
    cat "$logs/$city.log"
    echo "::endgroup::"
done
# Let the parallel batch finish, then retry only the matching failures, once each.
for city in "${retry_cities[@]}"; do
    echo "::group::$city (retry)"
    if ! "${@//\{\}/$city}"; then
        echo "::error::$city failed on retry"
        status=1
    fi
    echo "::endgroup::"
done
exit "$status"
