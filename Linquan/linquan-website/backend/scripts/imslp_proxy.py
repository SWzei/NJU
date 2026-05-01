#!/usr/bin/env python3
"""
IMSLP Python proxy for Node.js backend.
Runs as a long-lived process. Reads line-delimited JSON requests from stdin
and writes line-delimited JSON responses to stdout.
"""

import json
import os
import sys
import traceback

import imslp.interfaces.internal

from imslp_proxy_local.constants import CACHE_DIR
from imslp_proxy_local.utils import serialize
from imslp_proxy_local.search import (
    action_search_works,
    action_search_people,
    action_list_works,
    action_list_people,
)
from imslp_proxy_local.work_detail import action_work_detail
from imslp_proxy_local.person_detail import action_person_detail


def _load_local_cache():
    works_path = os.path.join(CACHE_DIR, "imslp_works_cache.json")
    people_path = os.path.join(CACHE_DIR, "imslp_people_cache.json")
    if os.path.exists(works_path):
        try:
            with open(works_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            imslp.interfaces.internal._cache_works = [
                imslp.interfaces.internal.HashablePageRecord(r) for r in data
            ]
            print(f"Loaded {len(data)} works from local cache", file=sys.stderr)
        except Exception as e:
            print(f"Failed to load works cache: {e}", file=sys.stderr)
    if os.path.exists(people_path):
        try:
            with open(people_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            imslp.interfaces.internal._cache_people = [
                imslp.interfaces.internal.HashablePageRecord(r) for r in data
            ]
            print(f"Loaded {len(data)} people from local cache", file=sys.stderr)
        except Exception as e:
            print(f"Failed to load people cache: {e}", file=sys.stderr)


_load_local_cache()


ACTIONS = {
    "search_works": action_search_works,
    "search_people": action_search_people,
    "list_works": action_list_works,
    "list_people": action_list_people,
    "work_detail": action_work_detail,
    "person_detail": action_person_detail,
}


def handle_request(req: dict):
    action = req.get("action")
    args = req.get("args", {})
    handler = ACTIONS.get(action)
    if not handler:
        return {"ok": False, "error": f"Unknown action: {action}"}
    try:
        result = handler(args)
        return {"ok": True, "data": result}
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        return {"ok": False, "error": str(e)}


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            resp = {"ok": False, "error": f"Invalid JSON: {e}"}
            print(json.dumps(resp))
            sys.stdout.flush()
            continue

        resp = handle_request(req)
        print(json.dumps(resp, default=serialize))
        sys.stdout.flush()


if __name__ == "__main__":
    main()
