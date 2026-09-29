from __future__ import annotations

from typing import Any, Iterable

from category_service import get_categories_for_user


def get_categories_endpoint(user_id: int, categories: Iterable[Any], transactions: Iterable[Any]):
    """Web-layer adapter that matches the issue's GET /api/categories contract."""
    return get_categories_for_user(user_id, categories, transactions)
