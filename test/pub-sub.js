const test = require("ava");
const { createBus } = require("../cjs/browser-bus.js");

test("publish delivers to matching subscriber", (t) => {
  const bus = createBus();
  const received = [];

  bus.subscribe("orders.created", (msg) => {
    received.push(msg);
  });

  bus.publish("orders.created", { id: 1 });

  t.is(received.length, 1);
  t.is(received[0].subject, "orders.created");
  t.deepEqual(received[0].data, { id: 1 });
});

test("publish delivers to multiple subscribers", (t) => {
  const bus = createBus();
  let count = 0;

  bus.subscribe("orders.created", () => { count++; });
  bus.subscribe("orders.*", () => { count++; });

  bus.publish("orders.created", {});

  t.is(count, 2);
});

test("publish does not deliver to non-matching subscriber", (t) => {
  const bus = createBus();
  let called = false;

  bus.subscribe("users.created", () => { called = true; });

  bus.publish("orders.created", {});

  t.false(called);
});

test("unsubscribe stops delivery", (t) => {
  const bus = createBus();
  let count = 0;

  const unsub = bus.subscribe("orders.created", () => { count++; });

  bus.publish("orders.created", {});
  t.is(count, 1);

  unsub();

  bus.publish("orders.created", {});
  t.is(count, 1);
});

test("publish swallows sync handler errors", (t) => {
  const bus = createBus();

  bus.subscribe("fail", () => {
    throw new Error("boom");
  });

  // should not throw
  t.notThrows(() => bus.publish("fail", {}));
});

test("wildcard > receives all nested publishes", (t) => {
  const bus = createBus();
  const subjects = [];

  bus.subscribe("events.>", (msg) => {
    subjects.push(msg.subject);
  });

  bus.publish("events.click", {});
  bus.publish("events.hover.button", {});
  bus.publish("events.scroll.page.down", {});

  t.deepEqual(subjects, [
    "events.click",
    "events.hover.button",
    "events.scroll.page.down",
  ]);
});
