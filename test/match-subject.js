const test = require("ava");
const { matchSubject } = require("../cjs/browser-bus.js");

// ── exact match ──

test("exact match", (t) => {
  t.true(matchSubject("orders.created", "orders.created"));
});

test("exact mismatch", (t) => {
  t.false(matchSubject("orders.created", "orders.updated"));
});

test("different depth is mismatch", (t) => {
  t.false(matchSubject("orders", "orders.created"));
});

// ── single-token wildcard * ──

test("* matches one token", (t) => {
  t.true(matchSubject("orders.*", "orders.created"));
});

test("* does not match zero tokens", (t) => {
  t.false(matchSubject("orders.*", "orders"));
});

test("* does not match two tokens", (t) => {
  t.false(matchSubject("orders.*", "orders.created.uk"));
});

test("* in the middle", (t) => {
  t.true(matchSubject("orders.*.uk", "orders.created.uk"));
  t.false(matchSubject("orders.*.uk", "orders.created.us"));
});

// ── tail wildcard > ──

test("> matches one remaining token", (t) => {
  t.true(matchSubject("orders.>", "orders.created"));
});

test("> matches many remaining tokens", (t) => {
  t.true(matchSubject("orders.>", "orders.created.uk.london"));
});

test("> matches zero remaining tokens", (t) => {
  t.true(matchSubject("orders.>", "orders"));
});

test("> must be last token", (t) => {
  // ">.orders" — > is not last, so it should only match a literal ">" first token
  t.false(matchSubject(">.orders", "anything.orders"));
});

// ── edge cases ──

test("single token subject and pattern", (t) => {
  t.true(matchSubject("orders", "orders"));
  t.false(matchSubject("orders", "users"));
});

test("* alone matches any single token", (t) => {
  t.true(matchSubject("*", "orders"));
  t.false(matchSubject("*", "orders.created"));
});

test("> alone matches anything", (t) => {
  t.true(matchSubject(">", "orders"));
  t.true(matchSubject(">", "orders.created.uk"));
});
