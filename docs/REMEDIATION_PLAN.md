# Remediation Plan: Audit Findings

This document tracks remediation work for the five findings identified in the comprehensive audit.

## Status Summary

| Finding | Severity | Status | Scope |
|---|---|---|---|
| F1: Reconnect and channel recovery gaps | High | Completed | `src/connection`, `src/consumer`, tests |
| F2: Compatibility checks not enforced in runtime paths | Medium | Completed | `src/contracts`, `src/consumer`, `src/publisher`, tests |
| F3: Publisher backpressure handling missing | Medium | Completed | `src/publisher`, tests |
| F4: Published artifact includes compiled tests | Low | Completed | build/test configs, `package.json` |
| F5: Public module naming divergence from spec recommendation | Low | Completed | `package.json`, docs |

## Finding F1: Reconnect and Channel Recovery

### Problem
Connection state was marked disconnected on broker events, but there was no built-in reconnect loop with re-initialization callbacks for consumer/publisher setup.

### Remediation Steps
1. Add reconnect configuration knobs and defaults in `EdgeChannelConfig`.
2. Implement reconnect loop with bounded exponential delay in `EdgeChannelConnectionManager`.
3. Add subscriber callback mechanism to run post-reconnect re-initialization hooks.
4. Register consumer re-initialization hook to recreate exchange/queue/bind/consume state.
5. Add/extend tests for reconnect behavior.

### Success Criteria
- Connection manager retries automatically when enabled.
- Consumer returns to active consumption after reconnect without requiring process restart.
- Health reports reconnect status and attempts.

## Finding F2: Runtime Compatibility Enforcement

### Problem
Compatibility metadata validation existed but was not enforced in consumer and publisher runtime paths.

### Remediation Steps
1. Extend compatibility options with role-scoped checks (`consumer`/`producer`/`both`).
2. Support strict runtime version requirements when minimum compatible versions are declared.
3. Enforce compatibility on consumer inbound envelopes.
4. Enforce compatibility on publisher outbound events.
5. Add tests for accept/reject behavior when runtime version is missing or below minimum.

### Success Criteria
- Envelopes with unmet minimum version requirements fail before processing/publish.
- Runtime versions can be configured per consumer/publisher.

## Finding F3: Publisher Backpressure Handling

### Problem
Publisher ignored `channel.publish` flow-control signaling and had no drain wait behavior.

### Remediation Steps
1. Add configurable `backpressureTimeoutMs`.
2. Check boolean result from `channel.publish`.
3. Await `drain` event before continuing when publish returns `false`.
4. Fail clearly on drain timeout.
5. Add tests covering backpressure path.

### Success Criteria
- Publish path behaves safely under broker/client pressure.
- Backpressure timeout behavior is deterministic and observable.

## Finding F4: Test Output in Published Artifacts

### Problem
`dist` included compiled tests due broad TypeScript include pattern and tests executing from `dist`.

### Remediation Steps
1. Exclude `src/__tests__` from production `tsconfig.json`.
2. Introduce a dedicated `tsconfig.test.json` that compiles test targets to `dist-test`.
3. Update scripts so test commands build production and test outputs separately.
4. Verify `npm pack --dry-run` excludes test artifacts from published `dist` payload.

### Success Criteria
- Production package payload contains runtime/public files only.
- Tests still run reliably via `dist-test`.

## Finding F5: Package/Module Naming Divergence

### Problem
Implementation used `amqp-mcp-edge/*` while the final published package identity is `@nagual69/amqp-mcp-edge/*`.

### Remediation Steps
1. Update package name to `@nagual69/amqp-mcp-edge`.
2. Update README usage and module references to scoped package imports.
3. Update release docs/changelog references.
4. Validate package metadata and dry-run publish flow.

### Success Criteria
- Package and documentation reflect scoped identity.
- Public subpath imports align with recommended module naming style.

## Validation Plan

1. Run `npm run build`.
2. Run `npm run test:unit`.
3. Run `npm run test:integration`.
4. Run `npm run release:check`.
5. Review `npm pack --dry-run` contents for expected publish payload.

## Risks and Notes

- Renaming package identity to scoped form can affect existing consumers; migration notes should be included at release.
- Reconnect logic must avoid duplicate consumer registration and should be covered by reconnection tests.
- Backpressure behavior depends on broker/client signaling and should include deterministic test doubles where needed.
