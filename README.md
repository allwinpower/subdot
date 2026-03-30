<p align="center">
  <img src="https://raw.githubusercontent.com/allwinpower/subdot/main/assets/logo/subdot-logo-wordmark.png" alt="subdot — in-browser subject bus" width="480" />
</p>

# subdot

Minimal in-browser pub/sub bus with wildcard subjects (`*`, `>`) and request/reply with timeout.

NATS-style messaging, zero dependencies.

## features

- publish
- subscribe
- request
- wildcard subject matching
  - `orders.*`
  - `orders.>`
- multiple subscribers
- request timeout
- tiny and in-memory
- built for browser apps and component communication

## what it is

`subdot` is a tiny in-tab message bus for browser applications.

It gives you a clean subject-based API similar to NATS, but without a server, WebSocket, or broker.

Use it when you want parts of your UI or app logic to communicate through subjects like:

- `orders.created`
- `ui.toast.show`
- `storage.get`
- `component.header.clicked`

## install

For now, copy the file into your project or publish it later as a package.

```ts
import { createBus } from "./browser-bus"
```

## api

## `createBus()`

Creates a new in-memory bus.

```ts
const bus = createBus()
```

Returns:

- `publish(subject, data)`
- `subscribe(pattern, handler)`
- `request(subject, data, { timeout })`

---

## `publish(subject, data)`

Fire-and-forget.

Calls all matching subscribers.

```ts
bus.publish("orders.created", { id: 123 })
```

### behavior

- all matching subscribers are called
- return values are ignored
- handler errors are ignored by publish on purpose

---

## `subscribe(pattern, handler)`

Subscribe to an exact subject or wildcard pattern.

```ts
const unsubscribe = bus.subscribe("orders.created", ({ subject, data }) => {
  console.log(subject, data)
})
```

Returns an unsubscribe function:

```ts
unsubscribe()
```

---

## `request(subject, data, { timeout })`

Calls all matching subscribers and resolves with the first successful reply.

```ts
const result = await bus.request("user.get", { id: 42 }, { timeout: 1000 })
```

### behavior

- all matching handlers are started
- the first successful result wins
- later results are ignored
- if no subscriber matches, it rejects immediately
- if all matching handlers fail, it rejects
- if no successful reply arrives before timeout, it rejects

### important

Because all matching handlers run, `request()` is best for:

- reads
- lookups
- safe/idempotent operations
- fallback responders

It is not ideal for side-effect-heavy operations like:

- charging money
- writing the same record from multiple handlers
- non-idempotent actions

---

## wildcard rules

Subjects are split by `.` into tokens.

### `*`
Matches exactly one token.

Example:

- `orders.*` matches `orders.created`
- `orders.*` matches `orders.updated`
- `orders.*` does **not** match `orders.eu.created`
- `orders.*` does **not** match `orders`

### `>`
Matches the rest of the subject and must be the last token.

Example:

- `orders.>` matches `orders.created`
- `orders.>` matches `orders.eu.created`
- `orders.>` matches `orders.eu.fr.created`
- `orders.>` does **not** match `payments.created`

### examples

Valid patterns:

- `orders.created`
- `orders.*`
- `orders.>`
- `component.*.clicked`
- `component.>`

Not supported:

- `orders.creat*`
- `*.created.foo*`
- partial wildcard inside a token

---

## example

```ts
import { createBus } from "./browser-bus"

const bus = createBus()

bus.subscribe("orders.created", ({ subject, data }) => {
  console.log("exact:", subject, data)
})

bus.subscribe("orders.*", ({ subject, data }) => {
  console.log("one token wildcard:", subject, data)
})

bus.subscribe("orders.>", ({ subject, data }) => {
  console.log("deep wildcard:", subject, data)
})

bus.publish("orders.created", { id: 123 })
bus.publish("orders.eu.created", { id: 456 })
```

### output behavior

For `orders.created`:

- matches `orders.created`
- matches `orders.*`
- matches `orders.>`

For `orders.eu.created`:

- does not match `orders.*`
- matches `orders.>`

---

## request/reply example

```ts
import { createBus } from "./browser-bus"

const bus = createBus()

bus.subscribe("user.get", async ({ data }) => {
  await new Promise((resolve) => setTimeout(resolve, 200))
  return { id: data.id, name: "john" }
})

const user = await bus.request<{ id: number }, { id: number; name: string }>(
  "user.get",
  { id: 42 },
  { timeout: 1000 }
)

console.log(user)
```

---

## multiple request responders

```ts
import { createBus } from "./browser-bus"

const bus = createBus()

bus.subscribe("profile.get", async ({ data }) => {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return { source: "slow", id: data.id }
})

bus.subscribe("profile.*", async ({ data }) => {
  await new Promise((resolve) => setTimeout(resolve, 100))
  return { source: "fast wildcard", id: data.id }
})

const profile = await bus.request("profile.get", { id: 1 }, { timeout: 1000 })

console.log(profile)
// => { source: "fast wildcard", id: 1 }
```

---

## timeout example

```ts
try {
  await bus.request("payment.check", { id: 1 }, { timeout: 500 })
} catch (error) {
  console.error(error)
}
```

This rejects if:

- no handler matches
- all handlers fail
- timeout is reached before any successful reply

---

## recommended subject design

Good subject naming makes the system easy to reason about.

Examples:

- `ui.toast.show`
- `ui.modal.open`
- `storage.get`
- `storage.set`
- `theme.current`
- `theme.changed`
- `component.header.clicked`
- `component.sidebar.toggle`

### rule of thumb

- use `publish()` for events
- use `request()` for reads and lookup-style interactions

---

## roadmap ideas

Possible future additions:

- debug mode
- scoped clients
- cross-tab transport
- middleware
- collect-all request mode
- package publishing
- tests

## interactive demo

A self-contained `demo.html` is included. It lets you subscribe, publish, and send requests in the browser with a live event log.

```bash
npm run build
npx serve .
```

Then open the printed URL in your browser.

The demo has three panels:

- **Subscribe** — register patterns like `orders.*` or `events.>`, with an unsub button per subscription
- **Publish** — send a message to any subject with a JSON payload
- **Request / Reply** — send a request and see the response (or timeout error) in the log

All activity shows in the **Event Log** at the bottom with color-coded tags: `[SUB]`, `[PUB]`, `[RECV]`, `[REQ]`, `[RES]`, `[ERR]`.

## license

MIT
