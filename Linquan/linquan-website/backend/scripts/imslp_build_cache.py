#!/usr/bin/env python3
"""
Build local cache files for imslp works and people.
Run this once during deployment to avoid long waits on first search.
"""

import json
import os
import sys

import imslp.interfaces.internal as internal

CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'cache')
os.makedirs(CACHE_DIR, exist_ok=True)


def save_json(path, records):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump([dict(r) for r in records], f, ensure_ascii=False)
    print(f"Saved {len(records)} records to {path}")


def main():
    print("Building works cache...")
    works = internal.list_works(start=0, count=None, cache=False)
    save_json(os.path.join(CACHE_DIR, 'imslp_works_cache.json'), works)

    print("Building people cache...")
    people = internal.list_people(start=0, count=None, cache=False)
    save_json(os.path.join(CACHE_DIR, 'imslp_people_cache.json'), people)

    print("Done.")


if __name__ == "__main__":
    main()
