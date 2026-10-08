# sep29

## Transactions endpoint contract

`tests/test_transactions_endpoint_contract.py` contains the pytest endpoint
contract for the transaction filters. The endpoint's integration test should
import `transactions_endpoint_contract` and pass a dependency-injected Python
harness through `create_endpoint`.

The contract chooses to return `400` when a cursor from an unfiltered request
is reused with filters, rather than silently reusing that cursor.