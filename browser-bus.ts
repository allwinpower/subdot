type Subject = string
type Pattern = string

export type BusMessage<T = unknown> = {
  subject: Subject
  data: T
}

export type BusHandler<TReq = unknown, TRes = unknown> = (
  msg: BusMessage<TReq>
) => TRes | Promise<TRes>

export type RequestOptions = {
  timeout?: number
}

type Subscription = {
  pattern: Pattern
  handler: BusHandler
}

function splitTokens(value: string): string[] {
  return value.split('.').filter(Boolean)
}

/**
 * NATS-style matcher:
 * - "*" matches exactly one token
 * - ">" matches the rest of the subject and must be the last token
 */
export function matchSubject(pattern: string, subject: string): boolean {
  const p = splitTokens(pattern)
  const s = splitTokens(subject)

  let pi = 0
  let si = 0

  while (pi < p.length && si < s.length) {
    const pt = p[pi]
    const st = s[si]

    if (pt === '>') {
      return pi === p.length - 1
    }

    if (pt === '*' || pt === st) {
      pi++
      si++
      continue
    }

    return false
  }

  if (pi === p.length && si === s.length) {
    return true
  }

  if (pi === p.length - 1 && p[pi] === '>') {
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
            // ignore async publish errors on purpose
          })
        }
      } catch {
        // ignore sync publish errors on purpose
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
