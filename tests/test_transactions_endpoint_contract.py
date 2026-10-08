from dataclasses import dataclass
from typing import Any, Protocol

import pytest


@dataclass(frozen=True)
class Transaction:
    id: str
    occurred_at: str
    category_id: str | None


@dataclass(frozen=True)
class Request:
    user_id: str
    query: dict[str, str]
    profile_time_zone: str | None = None


@dataclass(frozen=True)
class Response:
    status: int
    transactions: list[Transaction]
    total_count: int
    next_cursor: str | None = None
    error: Any = None


@dataclass(frozen=True)
class QueryCall:
    text: str
    parameters: tuple[Any, ...]


class TransactionsEndpointHarness(Protocol):
    def request(self, request: Request) -> Response: ...

    def query_calls(self) -> list[QueryCall]: ...


CreateTransactionsEndpoint = Any

USER_ID = "user-1"
CATEGORY_ID = "category-1"
OTHER_USER_CATEGORY_ID = "category-2"
DELETED_CATEGORY_ID = "category-deleted"


def transaction(
    transaction_id: str,
    occurred_at: str,
    category_id: str | None,
) -> Transaction:
    return Transaction(transaction_id, occurred_at, category_id)


def transactions_endpoint_contract(create_endpoint: CreateTransactionsEndpoint) -> None:
    """Run the endpoint contract against an injected Python endpoint harness.

    The cursor policy is intentionally strict: a cursor from an unfiltered
    request reused with filters must return HTTP 400.
    """

    endpoint = create_endpoint()

    response = endpoint.request(
        Request(
            USER_ID,
            {"startDate": "2024-02-30", "includeUncategorized": "maybe"},
        )
    )
    assert response.status == 400
    assert response.error == [
        {"field": "startDate", "message": 'Invalid date: "2024-02-30"'},
        {"field": "includeUncategorized", "message": 'Invalid boolean: "maybe"'},
    ]

    response = endpoint.request(
        Request(
            USER_ID,
            {"startDate": "2024-01-01", "endDate": "2024-01-31"},
            "America/New_York",
        )
    )
    assert response.transactions == [
        transaction("start", "2024-01-01T00:00:00.000Z", CATEGORY_ID),
        transaction("end", "2024-02-01T06:59:59.999Z", CATEGORY_ID),
    ]
    assert "America/New_York" in endpoint.query_calls()[0].parameters

    response = endpoint.request(Request(USER_ID, {"endDate": "2024-01-31"}))
    assert "UTC" in endpoint.query_calls()[-1].parameters
    assert transaction("last-minute", "2024-02-01T04:59:00.000Z", CATEGORY_ID) in response.transactions

    response = endpoint.request(
        Request(
            USER_ID,
            {
                "startDate": "2024-01-01",
                "endDate": "2024-01-31",
                "categoryIds": "category-1,category-3",
            },
        )
    )
    assert [item.id for item in response.transactions] == [
        "category-1-in-range",
        "category-3-in-range",
    ]

    response = endpoint.request(Request(USER_ID, {"includeUncategorized": "true"}))
    assert transaction("uncategorized", "2024-01-15T12:00:00.000Z", None) in response.transactions

    response = endpoint.request(
        Request(
            USER_ID,
            {"categoryIds": CATEGORY_ID, "limit": "2", "sort": "occurredAt:desc"},
        )
    )
    assert [item.id for item in response.transactions] == ["newest", "older"]
    assert response.next_cursor is not None

    response = endpoint.request(Request(USER_ID, {"categoryIds": CATEGORY_ID}))
    assert response.total_count == 3

    endpoint.request(
        Request(
            USER_ID,
            {"startDate": "2024-01-01", "categoryIds": "category-' OR 1=1 --"},
        )
    )
    for call in endpoint.query_calls():
        assert "category-' OR 1=1 --" not in call.text
        assert "2024-01-01" not in call.text
        assert "category-' OR 1=1 --" in call.parameters

    response = endpoint.request(Request(USER_ID, {"categoryIds": OTHER_USER_CATEGORY_ID}))
    assert response.status == 200
    assert response.transactions == []
    assert transaction(
        "other-user-transaction", "2024-01-15T12:00:00.000Z", OTHER_USER_CATEGORY_ID
    ) not in response.transactions

    response = endpoint.request(Request(USER_ID, {"categoryIds": DELETED_CATEGORY_ID}))
    assert response.status == 200
    assert response.transactions == []
    assert response.error is None

    response = endpoint.request(
        Request(
            USER_ID,
            {
                "cursor": "cursor-from-unfiltered-request",
                "categoryIds": CATEGORY_ID,
            },
        )
    )
    assert response.status == 400
    assert response.error == {
        "field": "cursor",
        "message": "Cursor cannot be reused with different filters",
    }

    response = endpoint.request(Request(USER_ID, {"endDate": "2024-01-31"}))
    assert transaction("last-minute", "2024-02-01T04:59:00.000Z", CATEGORY_ID) in response.transactions

    response = endpoint.request(Request(USER_ID, {}))
    assert response.status == 200
    assert response.transactions == [
        transaction("newest", "2024-02-01T04:59:00.000Z", CATEGORY_ID),
        transaction("older", "2024-01-15T12:00:00.000Z", CATEGORY_ID),
    ]
    assert response.total_count == 2


@pytest.mark.skip(reason="Activate from the Python endpoint integration test once the handler exists")
def test_transactions_endpoint_contract() -> None:
    """Placeholder entry point for the future concrete endpoint harness."""

    raise AssertionError("Pass the real endpoint factory to transactions_endpoint_contract")