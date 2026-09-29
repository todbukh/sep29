from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional


@dataclass
class Category:
    id: int
    user_id: int
    name: str
    color: Optional[str] = None
    deleted_at: Optional[datetime] = None


@dataclass
class Transaction:
    id: int
    user_id: int
    category_id: Optional[int] = None
    deleted_at: Optional[datetime] = None


def _get_value(item: Any, key: str) -> Any:
    if hasattr(item, key):
        return getattr(item, key)
    if isinstance(item, dict):
        return item.get(key)
    return None


def _is_active(item: Any) -> bool:
    return _get_value(item, "deleted_at") is None


def get_categories_for_user(
    user_id: int,
    categories: Iterable[Any],
    transactions: Iterable[Any],
) -> Dict[str, Any]:
    """Return the authenticated user's active categories and uncategorized count.

    The returned payload mirrors the issue requirements for a GET /api/categories
    response while remaining framework-agnostic for easier reuse in tests or a web
    app adapter.
    """
    active_categories = [
        category
        for category in categories
        if _get_value(category, "user_id") == user_id and _is_active(category)
    ]
    active_transactions = [
        transaction
        for transaction in transactions
        if _get_value(transaction, "user_id") == user_id and _is_active(transaction)
    ]

    category_counts: Dict[int, int] = {}
    uncategorized_count = 0

    for transaction in active_transactions:
        category_id = _get_value(transaction, "category_id")
        if category_id is None:
            uncategorized_count += 1
            continue
        category_counts[category_id] = category_counts.get(category_id, 0) + 1

    categories_payload: List[Dict[str, Any]] = []
    for category in sorted(active_categories, key=lambda item: (_get_value(item, "name") or "").lower()):
        category_id = _get_value(category, "id")
        payload: Dict[str, Any] = {
            "id": category_id,
            "name": _get_value(category, "name"),
            "transactionCount": category_counts.get(category_id, 0),
        }
        color = _get_value(category, "color")
        if color is not None:
            payload["color"] = color
        categories_payload.append(payload)

    return {
        "categories": categories_payload,
        "uncategorizedTransactionCount": uncategorized_count,
    }
