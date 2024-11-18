#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <platform>"
    exit 1
fi

platform="$1"
version_codes=()

for tag in $(git tag --list "${platform}-release/*"); do
    version=$(echo $tag | sed "s/${platform}-release\///g")
    version_codes+=($version)
done

next_version=$(($(printf '%d\n' "${version_codes[@]}" | sort -n | tail -1) + 1))

echo $next_version
