"""Retired: restored banking sessions and authorizations are live data."""
import sys


def main():
    print("Cleanup disabled: Enable Banking sessions and evidence must be preserved.", file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
