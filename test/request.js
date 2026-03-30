const test = require("ava");
const { createBus } = require("../cjs/browser-bus.js");

test("request returns first responder's value", async (t) => {
  const bus = createBus();

  bus.subscribe("user.get", (msg) => {
    return { name: "Alice", id: msg.data.id };
  });

  const result = await bus.request("user.get", { id: 42 });

  t.deepEqual(result, { name: "Alice", id: 42 });
});

test("request works with async handler", async (t) => {
  const bus = createBus();

  bus.subscribe("user.get", async (msg) => {
    return { name: "Bob", id: msg.data.id };
  });

  const result = await bus.request("user.get", { id: 7 });

  t.deepEqual(result, { name: "Bob", id: 7 });
});

test("request throws when no subscriber matches", async (t) => {
  const bus = createBus();

  await t.throwsAsync(() => bus.request("nobody.home", {}), {
    message: /No subscriber matched/,
  });
});

test("request rejects on timeout", async (t) => {
  const bus = createBus();

  bus.subscribe("slow", () => {
    return new Promise((resolve) => setTimeout(resolve, 500));
  });

  await t.throwsAsync(() => bus.request("slow", {}, { timeout: 50 }), {
    message: /timeout/i,
  });
});

test("request rejects when all handlers fail", async (t) => {
  const bus = createBus();

  bus.subscribe("fail", () => {
    throw new Error("handler error");
  });

  await t.throwsAsync(() => bus.request("fail", {}), {
    message: /All request handlers failed/,
  });
});

test("request first responder wins among multiple", async (t) => {
  const bus = createBus();

  bus.subscribe("race", () => "first");
  bus.subscribe("race", () => "second");

  const result = await bus.request("race", {});

  // both are sync so first registered wins
  t.is(result, "first");
});
