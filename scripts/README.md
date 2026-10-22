# Development scripts

- `capture-board-inventories.py`: initializes paused instances of all presets using the exact pinned QEMU build, then captures QOM devices/signals and every resolved memory FlatView. See docs/BOARDS.md for reproduction and scope.
- `generate-bare-metal.py`: generates the constrained Arm virt bare-metal project and argument plan from its versioned recipe. No tools are executed or downloaded by this script; see docs/BARE_METAL.md.
- `check-commits.py`: checks commit subjects via the tracked commit-msg hook, or new commit subjects and PR titles from a GitHub event. It never rewrites history.
- `tooling_test.py`: regression checks for capture parsing and commit conventions. Run `python3 -m unittest discover -s scripts -p "*_test.py"`.

Helpers never install system dependencies silently. Build artifacts and the generated paused-only PolarFire firmware fixture stay under ignored build/.
