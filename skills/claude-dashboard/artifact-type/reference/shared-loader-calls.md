# A loader's further calls on a shared connector

A `call` runs as the sharer when it differs only in its days from what the loader called when its sharer last shared.

- Keep each date a whole value, or a list of them, and a day (`2026-10-27`), worked out from the answer. A date written in the code stays fixed.
- Other text must be a short name or a string written in the code.
- A call that differs in anything else, or a poll for a query left running, sends the whole load to each viewer's own connector.
- A new or changed call is held only after the sharer loads the Dashboard and shares again.
