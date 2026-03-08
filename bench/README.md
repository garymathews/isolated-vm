# Benchmarks

These scripts provide a small repeatable benchmark harness for the runtime paths most likely to
show user-visible performance changes.

## Commands

```sh
npm run bench
npm run bench:micro
npm run bench:runtime
```

All commands should be run against a Release build of the addon. The scripts use
`process.hrtime.bigint()`, warm each case before sampling, and report median, mean, and operations
per second.

## Coverage

- isolate startup and context creation
- script compilation with small, large, and cached-data sources
- `Reference` creation and `applySync` / `getSync` / `setSync` / `copySync`
- `ExternalCopy` for primitive, string, object, typed-array copy, and transfer-list cases

## Notes

- Some cases intentionally create fresh isolates so internal V8 caching does not dominate results.
- Compare Release builds only.
- When validating a candidate change, run the relevant micro-benchmark first, then the full suite.
