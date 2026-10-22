#!/usr/bin/env python3
"""Validate new commit subjects and PR titles; historical commits are unchanged."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

PATTERN = re.compile(r"^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-zA-Z0-9_./-]+\))?!?: \S.*$")


def check(subject):
    if not PATTERN.fullmatch(subject):
        raise SystemExit(f"Invalid commit/PR title: {subject!r}\nUse type(scope): description, e.g. feat(boards): expand peripheral inventory")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", type=Path)
    parser.add_argument("--event", type=Path)
    args = parser.parse_args()
    if args.file:
        lines = args.file.read_text().splitlines()
        check(lines[0] if lines else "")
        return
    event = json.loads((args.event or Path(os.environ["GITHUB_EVENT_PATH"])).read_text())
    if "pull_request" in event:
        pr = event["pull_request"]
        check(pr["title"])
        base, head = pr["base"]["sha"], pr["head"]["sha"]
    else:
        base, head = event["before"], event["after"]
    if head == "0" * 40:
        return
    if not all(re.fullmatch(r"[0-9a-f]{40}", value) for value in (base, head)):
        raise SystemExit("Expected full Git commit SHAs")
    # New branches also validate only new work after the existing scaffold.
    if base == "0" * 40:
        base = "498ccf6"
    subjects = subprocess.check_output(["git", "log", "--no-merges", "--format=%s", f"{base}..{head}"], text=True)
    for subject in subjects.splitlines():
        check(subject)
    print("Conventional commit subjects and PR title are valid.")


if __name__ == "__main__":
    main()
