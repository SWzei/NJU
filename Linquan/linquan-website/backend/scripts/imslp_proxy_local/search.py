import re

import imslp.interfaces.internal
import imslp.interfaces.mw_api

from .utils import tokenize, extract_composer_from_title, is_junk_result, normalize_record


def _score_field(query_tokens, field_value):
    """计算一组搜索词在单个字段上的匹配情况。
    返回 (匹配词数, 分数)。分数越高表示匹配质量越好。"""
    if not field_value:
        return 0, 0
    field_lower = field_value.lower()
    matched = 0
    score = 0
    for token in query_tokens:
        if not token:
            continue
        if token == field_lower:
            matched += 1
            score += 100
        elif re.search(r'\b' + re.escape(token) + r'\b', field_lower):
            matched += 1
            score += 50
        elif field_lower.startswith(token):
            matched += 1
            score += 20
        elif token in field_lower:
            matched += 1
            score += 10
    return matched, score


def _smart_search_works(title, composer, limit=100):
    """乐谱搜索：分词匹配 + 跨字段搜索 + 按相关性排序。"""
    records = list(imslp.interfaces.internal.list_works())
    title_tokens = tokenize(title)
    composer_tokens = tokenize(composer)
    all_tokens = title_tokens + composer_tokens

    if not all_tokens:
        return records[:limit]

    scored = []
    for rec in records:
        worktitle = rec.get("intvals", {}).get("worktitle", "") or ""
        comp = rec.get("intvals", {}).get("composer", "") or ""
        permlink = rec.get("permlink", "") or ""
        rec_id = rec.get("id", "") or ""

        # title 关键词可以匹配 worktitle、permlink 或 id
        t_m1, t_s1 = _score_field(title_tokens, worktitle)
        t_m2, t_s2 = _score_field(title_tokens, permlink)
        t_m3, t_s3 = _score_field(title_tokens, rec_id)
        title_matched = max(t_m1, t_m2, t_m3)
        title_score = max(t_s1, t_s2, t_s3)

        # composer 关键词可以匹配 composer 字段、worktitle、permlink 或 id
        c_m1, c_s1 = _score_field(composer_tokens, comp)
        c_m2, c_s2 = _score_field(composer_tokens, worktitle)
        c_m3, c_s3 = _score_field(composer_tokens, permlink)
        c_m4, c_s4 = _score_field(composer_tokens, rec_id)
        comp_matched = max(c_m1, c_m2, c_m3, c_m4)
        comp_score = max(c_s1, c_s2, c_s3, c_s4)

        total_matched = title_matched + comp_matched
        total_score = title_score + comp_score

        # 加分项：关键词命中了"正确"的字段
        if title_tokens and t_m1 == len(title_tokens):
            total_score += 30
        if composer_tokens and c_m1 == len(composer_tokens):
            total_score += 30

        # 要求所有搜索词都必须在某处匹配到（跨字段也可）
        if total_matched >= len(all_tokens):
            scored.append((total_score, rec))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored[:limit]]


def _smart_search_people(name, limit=100):
    """人物搜索：分词匹配 + 按相关性排序。"""
    records = list(imslp.interfaces.internal.list_people())
    tokens = tokenize(name)

    if not tokens:
        return records[:limit]

    scored = []
    for rec in records:
        rec_id = rec.get("id", "") or ""
        permlink = rec.get("permlink", "") or ""

        m1, s1 = _score_field(tokens, rec_id)
        m2, s2 = _score_field(tokens, permlink)

        total_matched = max(m1, m2)
        total_score = max(s1, s2)

        if total_matched >= len(tokens):
            scored.append((total_score, rec))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored[:limit]]


def _score_mw_result(item, title_tokens, composer_tokens):
    """给 MediaWiki fallback 结果打分，用于排序。"""
    wt = item.get("intvals", {}).get("worktitle", "").lower()
    comp = item.get("intvals", {}).get("composer", "").lower()
    score = 0

    # title 词匹配 worktitle
    for t in title_tokens:
        if not t:
            continue
        if re.search(r'\b' + re.escape(t) + r'\b', wt):
            score += 50
        elif t in wt:
            score += 10

    # composer 词匹配 composer 或 worktitle
    for c in composer_tokens:
        if not c:
            continue
        if re.search(r'\b' + re.escape(c) + r'\b', comp):
            score += 50
        elif c in comp:
            score += 10
        elif re.search(r'\b' + re.escape(c) + r'\b', wt):
            score += 20
        elif c in wt:
            score += 5

    # 惩罚垃圾结果
    if is_junk_result(wt):
        score -= 200

    return score


def _mw_search(query: str, is_work: bool = True, limit: int = 20):
    client = imslp.interfaces.mw_api.ImslpMwClient()
    results = []
    seen = set()
    ns = 0 if is_work else 14
    try:
        for item in client.search(query, namespace=ns, what="text", limit=limit):
            title = item.get("title", "")
            if not is_work and title.startswith("Category:"):
                title = title[len("Category:"):]
            if is_junk_result(title):
                continue
            permlink = title.replace(" ", "_")
            if permlink in seen:
                continue
            seen.add(permlink)
            composer = extract_composer_from_title(title) if is_work else ""
            results.append({
                "id": title,
                "permlink": permlink,
                "intvals": {
                    "worktitle": title if is_work else "",
                    "composer": composer,
                },
            })
    except Exception:
        pass
    return results


def _mw_search_multi(queries, title_tokens, composer_tokens, is_work=True, limit=20):
    """用多个查询词分别搜索 MediaWiki，合并去重后按相关性排序返回。"""
    all_results = []
    seen = set()
    for q in queries:
        if not q:
            continue
        for item in _mw_search(q, is_work=is_work, limit=limit):
            if item["permlink"] not in seen:
                seen.add(item["permlink"])
                all_results.append(item)
        if len(all_results) >= limit * 2:
            break

    # 按相关性排序
    scored = [
        (_score_mw_result(item, title_tokens, composer_tokens), item)
        for item in all_results
    ]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:limit]]


def action_search_works(args: dict):
    title = args.get("title") or None
    composer = args.get("composer") or None
    results = _smart_search_works(title=title, composer=composer, limit=100)
    items = [normalize_record(r) for r in results]

    title_tokens = tokenize(title)
    composer_tokens = tokenize(composer)

    # Fallback to MediaWiki search if cache-based search yields nothing or very few results
    if len(items) < 5 and (title or composer):
        queries = []
        if composer and title:
            queries.append(f"{composer} {title}")
        if title:
            queries.append(title)
        if composer:
            queries.append(composer)
        fallback_items = _mw_search_multi(
            queries,
            title_tokens=title_tokens,
            composer_tokens=composer_tokens,
            is_work=True,
            limit=20,
        )
        # Merge and deduplicate
        seen = {item["permlink"] for item in items}
        for item in fallback_items:
            if item["permlink"] not in seen:
                seen.add(item["permlink"])
                items.append(item)

    return {"items": items}


def action_search_people(args: dict):
    name = args.get("name") or None
    results = _smart_search_people(name=name, limit=100)
    items = [normalize_record(r) for r in results]

    if len(items) < 5 and name:
        tokens = tokenize(name)
        fallback_items = _mw_search_multi(
            [name],
            title_tokens=[],
            composer_tokens=tokens,
            is_work=False,
            limit=20,
        )
        seen = {item["permlink"] for item in items}
        for item in fallback_items:
            if item["permlink"] not in seen:
                seen.add(item["permlink"])
                items.append(item)

    return {"items": items}


def action_list_works(args: dict):
    start = args.get("start", 0)
    count = args.get("count")
    cache = args.get("cache", True)
    results = imslp.interfaces.internal.list_works(start=start, count=count, cache=cache)
    return {"items": [normalize_record(r) for r in results]}


def action_list_people(args: dict):
    start = args.get("start", 0)
    count = args.get("count")
    cache = args.get("cache", True)
    results = imslp.interfaces.internal.list_people(start=start, count=count, cache=cache)
    return {"items": [normalize_record(r) for r in results]}
