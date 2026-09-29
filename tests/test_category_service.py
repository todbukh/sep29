from datetime import datetime

from category_service import Category, Transaction, get_categories_for_user


def test_returns_sorted_categories_for_authenticated_user_and_uncategorized_count():
    categories = [
        Category(id=1, user_id=10, name="Groceries", color="#00FF00"),
        Category(id=2, user_id=10, name="Bills", color="#FF0000"),
        Category(id=3, user_id=20, name="Travel", color="#0000FF"),
        Category(id=4, user_id=10, name="Dining", color="#ABCDEF"),
    ]

    transactions = [
        Transaction(id=101, user_id=10, category_id=1),
        Transaction(id=102, user_id=10, category_id=1),
        Transaction(id=103, user_id=10, category_id=None),
        Transaction(id=104, user_id=10, category_id=4),
        Transaction(id=105, user_id=20, category_id=3),
        Transaction(id=106, user_id=10, category_id=2),
    ]

    response = get_categories_for_user(10, categories, transactions)

    assert response["categories"] == [
        {"id": 2, "name": "Bills", "color": "#FF0000", "transactionCount": 1},
        {"id": 4, "name": "Dining", "color": "#ABCDEF", "transactionCount": 1},
        {"id": 1, "name": "Groceries", "color": "#00FF00", "transactionCount": 2},
    ]
    assert response["uncategorizedTransactionCount"] == 1


def test_empty_user_has_empty_categories_and_zero_uncategorized_count():
    categories = [
        Category(id=1, user_id=99, name="Travel", color="#111111"),
    ]
    transactions = [
        Transaction(id=1, user_id=99, category_id=1),
    ]

    response = get_categories_for_user(42, categories, transactions)

    assert response["categories"] == []
    assert response["uncategorizedTransactionCount"] == 0


def test_deleted_categories_are_excluded_and_zero_count_categories_still_returned():
    categories = [
        Category(id=1, user_id=10, name="Alpha", color="#111111"),
        Category(id=2, user_id=10, name="Beta", color="#222222", deleted_at=datetime(2026, 9, 1)),
        Category(id=3, user_id=10, name="Gamma", color="#333333"),
    ]
    transactions = [
        Transaction(id=1, user_id=10, category_id=1),
        Transaction(id=2, user_id=10, category_id=3, deleted_at=datetime(2026, 9, 2)),
        Transaction(id=3, user_id=10, category_id=None),
        Transaction(id=4, user_id=10, category_id=3),
    ]

    response = get_categories_for_user(10, categories, transactions)

    assert response["categories"] == [
        {"id": 1, "name": "Alpha", "color": "#111111", "transactionCount": 1},
        {"id": 3, "name": "Gamma", "color": "#333333", "transactionCount": 1},
    ]
    assert response["uncategorizedTransactionCount"] == 1
