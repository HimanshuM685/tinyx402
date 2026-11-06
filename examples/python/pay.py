"""Pay for a tinyx402 request from Python.

    pip install "x402[requests,evm]>=2.27"
    PRIVATE_KEY=0x... python pay.py "x402 protocol"
"""
import os
import sys

from eth_account import Account
from x402 import SchemeRegistration, x402ClientConfig, x402ClientSync
from x402.http import decode_payment_response_header
from x402.http.clients import x402_requests
from x402.mechanisms.evm.exact import ExactEvmScheme
from x402.mechanisms.evm.signers import EthAccountSigner

BASE = os.environ.get("TINYX402_URL", "http://localhost:3000")
NETWORK = "eip155:1874"
USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7"

account = Account.from_key(os.environ["PRIVATE_KEY"])
client = x402ClientSync.from_config(
    x402ClientConfig(
        schemes=[SchemeRegistration(network=NETWORK, client=ExactEvmScheme(EthAccountSigner(account)))],
        spend_controls={
            "allowed_assets": [{"network": NETWORK, "asset": USDT, "max_amount_per_payment": "100000"}],
        },
    )
)
session = x402_requests(client)

res = session.get(f"{BASE}/api/v1/search", params={"q": sys.argv[1] if len(sys.argv) > 1 else "x402"})
print(res.status_code, res.json())
if receipt := res.headers.get("PAYMENT-RESPONSE"):
    print("settlement:", decode_payment_response_header(receipt))
