import { createBus } from "../browser-bus"

const bus = createBus()

// publish / subscribe example
bus.subscribe("orders.created", ({ subject, data }) => {
  console.log("exact:", subject, data)
})

bus.subscribe("orders.*", ({ subject, data }) => {
  console.log("wildcard one level:", subject, data)
})

bus.subscribe("orders.>", ({ subject, data }) => {
  console.log("wildcard deep:", subject, data)
})

bus.publish("orders.created", { id: 123 })
bus.publish("orders.eu.created", { id: 456 })

// request / reply example
bus.subscribe("user.get", async ({ data }) => {
  await new Promise((r) => setTimeout(r, 200))
  return { id: data.id, name: "john" }
})

async function run() {
  const user = await bus.request<{ id: number }, { id: number; name: string }>(
    "user.get",
    { id: 42 },
    { timeout: 1000 }
  )

  console.log("user:", user)
}

run()
