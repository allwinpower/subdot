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

## minimal implementation example

```ts
type Subject = string
type Pattern = string

export type BusMessage<T = unknown> = {
  subject: Subject
  data: T
}

export type BusHandler<TReq = unknown, TRes = unknown> =
  (msg: BusMessage<TReq>) => TRes | Promise<TRes>

export type RequestOptions = {
  timeout?: number
}

type Subscription = {
  pattern: Pattern
  handler: BusHandler
}

function splitTokens(value: string): string[] {
  return value.split(".").filter(Boolean)
}

export function matchSubject(pattern: string, subject: string): boolean {
  const p = splitTokens(pattern)
  const s = splitTokens(subject)

  let pi = 0
  let si = 0

  while (pi < p.length && si < s.length) {
    const pt = p[pi]
    const st = s[si]

    if (pt === ">") {
      return pi === p.length - 1
    }

    if (pt === "*" || pt === st) {
      pi++
      si++
      continue
    }

    return false
  }

  if (pi === p.length && si === s.length) {
    return true
  }

  if (pi === p.length - 1 && p[pi] === ">") {
    return true
  }

  return false
}

export function createBus() {
  const subscriptions = new Set<Subscription>()

  function getMatchingHandlers(subject: Subject): BusHandler[] {
    const handlers: BusHandler[] = []

    for (const sub of subscriptions) {
      if (matchSubject(sub.pattern, subject)) {
        handlers.push(sub.handler)
      }
    }

    return handlers
  }

  function subscribe<TReq = unknown, TRes = unknown>(
    pattern: Pattern,
    handler: BusHandler<TReq, TRes>
  ): () => void {
    const sub: Subscription = {
      pattern,
      handler: handler as BusHandler,
    }

    subscriptions.add(sub)

    return function unsubscribe(): void {
      subscriptions.delete(sub)
    }
  }

  function publish<T = unknown>(subject: Subject, data: T): void {
    const handlers = getMatchingHandlers(subject)
    if (handlers.length === 0) return

    const msg: BusMessage<T> = { subject, data }

    for (const handler of handlers) {
      try {
        const result = handler(msg)
        if (result instanceof Promise) {
          result.catch(() => {
            // ignore async publish errors
          })
        }
      } catch {
        // ignore sync publish errors
      }
    }
  }

  async function request<TReq = unknown, TRes = unknown>(
    subject: Subject,
    data: TReq,
    options: RequestOptions = {}
  ): Promise<TRes> {
    const handlers = getMatchingHandlers(subject) as BusHandler<TReq, TRes>[]

    if (handlers.length === 0) {
      throw new Error(`No subscriber matched subject "${subject}"`)
    }

    const timeout = options.timeout ?? 1000
    const msg: BusMessage<TReq> = { subject, data }

    return new Promise<TRes>((resolve, reject) => {
      let settled = false
      let failures = 0

      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error(`Request timeout for subject "${subject}"`))
      }, timeout)

      for (const handler of handlers) {
        Promise.resolve()
          .then(() => handler(msg))
          .then((result) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(result)
          })
          .catch(() => {
            failures++

            if (!settled && failures === handlers.length) {
              settled = true
              clearTimeout(timer)
              reject(
                new Error(`All request handlers failed for subject "${subject}"`)
              )
            }
          })
      }
    })
  }

  return {
    publish,
    subscribe,
    request,
  }
}
```

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

## license

MIT
