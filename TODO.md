# TODO

## Setup AVA test runner

AVA is not yet installed. Run:

```bash
npm install --save-dev ava
```

Then run tests:

```bash
npm test
```

Test files are already written in `test/`:

- `test/match-subject.js` — wildcard pattern matching (*, >, exact)
- `test/pub-sub.js` — publish/subscribe, unsubscribe, error swallowing
- `test/request.js` — request/reply, timeout, all-handlers-fail

The `package.json` is already configured with:

```json
"test": "npm run build && ava --verbose -T 10000"
```

```json
"ava": {
  "failFast": true,
  "files": ["./test/**/*.js"]
}
```
