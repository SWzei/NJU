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

import imslp.client
import imslp.interfaces.constants
import imslp.interfaces.internal
import imslp.interfaces.mw_api
import imslp.interfaces.scraping

IMSLP_WIKI_PREFIX = "https://imslp.org/wiki/"

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "cache")


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


def _extract_page_title(permlink: str) -> str:
    if permlink.startswith(IMSLP_WIKI_PREFIX):
        return permlink[len(IMSLP_WIKI_PREFIX):]
    return permlink


def _normalize_record(record: dict) -> dict:
    rec = dict(record)
    permlink = rec.get("permlink", "")
    rec["permlink"] = _extract_page_title(permlink)
    return rec


def _serialize(obj):
    if isinstance(obj, set):
        return list(obj)
    if isinstance(obj, imslp.interfaces.internal.HashablePageRecord):
        return _normalize_record(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _mw_search(query: str, is_work: bool = True, limit: int = 20):
    client = imslp.interfaces.mw_api.ImslpMwClient()
    results = []
    ns = 0 if is_work else 14
    try:
        for item in client.search(query, namespace=ns, what="text", limit=limit):
            title = item.get("title", "")
            if not is_work and title.startswith("Category:"):
                title = title[len("Category:"):]
            results.append({
                "id": title,
                "permlink": title.replace(" ", "_"),
                "intvals": {
                    "worktitle": title if is_work else "",
                    "composer": "",
                },
            })
    except Exception:
        pass
    return results


def action_search_works(args: dict):
    title = args.get("title") or None
    composer = args.get("composer") or None
    intersect = args.get("intersect", True)
    case_insensitive = args.get("case_insensitive", True)
    results = imslp.client.ImslpClient.search_works(
        title=title,
        composer=composer,
        intersect=intersect,
        case_insensitive=case_insensitive,
    )
    items = [_normalize_record(r) for r in results]
    # Fallback to MediaWiki search if cache-based search yields nothing
    if not items and (title or composer):
        query = " ".join(filter(None, [composer, title]))
        items = _mw_search(query, is_work=True, limit=20)
    return {"items": items}


def action_search_people(args: dict):
    name = args.get("name") or None
    intersect = args.get("intersect", True)
    case_insensitive = args.get("case_insensitive", True)
    results = imslp.client.ImslpClient.search_people(
        name=name,
        intersect=intersect,
        case_insensitive=case_insensitive,
    )
    items = [_normalize_record(r) for r in results]
    if not items and name:
        items = _mw_search(name, is_work=False, limit=20)
    return {"items": items}


def action_list_works(args: dict):
    start = args.get("start", 0)
    count = args.get("count")
    cache = args.get("cache", True)
    results = imslp.interfaces.internal.list_works(start=start, count=count, cache=cache)
    return {"items": [_normalize_record(r) for r in results]}


def action_list_people(args: dict):
    start = args.get("start", 0)
    count = args.get("count")
    cache = args.get("cache", True)
    results = imslp.interfaces.internal.list_people(start=start, count=count, cache=cache)
    return {"items": [_normalize_record(r) for r in results]}


def action_work_detail(args: dict):
    permlink = _extract_page_title(args["permlink"])
    client = imslp.interfaces.mw_api.ImslpMwClient()
    page = client.pages[permlink]
    images = imslp.interfaces.scraping.fetch_images_metadata(page)
    # Remove non-serializable mwclient.image.Image objects
    for img in images:
        img.pop("obj", None)
    return {
        "permlink": permlink,
        "title": page.base_title,
        "images": images,
    }


def _fetch_category_members(client, category_name, subcategory=None):
    cat = f"Category:{category_name}"
    if subcategory:
        cat += f"/{subcategory}"
    try:
        page = client.pages[cat]
        members = []
        for member in page.members():
            title = member.name if hasattr(member, "name") else str(member)
            if title.startswith("Category:"):
                continue
            members.append({"Title": title})
        return members
    except Exception:
        return []


def action_person_detail(args: dict):
    permlink = _extract_page_title(args["permlink"])
    category_name = permlink.replace("_", " ")
    tables = {}
    client = imslp.interfaces.mw_api.ImslpMwClient()
    for subcategory in imslp.interfaces.constants.IMSLP_SUBCATEGORIES:
        table = []
        try:
            table = imslp.interfaces.scraping.fetch_category_table(
                category_name=category_name,
                subcategory=subcategory,
            )
        except Exception:
            pass
        if not table:
            table = _fetch_category_members(client, category_name, subcategory)
        if table:
            tables[subcategory] = table
    return {
        "permlink": permlink,
        "name": category_name,
        "categoryTables": tables,
    }


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
        print(json.dumps(resp, default=_serialize))
        sys.stdout.flush()


if __name__ == "__main__":
    main()
