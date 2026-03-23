# Spec Traceability Matrix

Source of truth: `AMQPCONNECTORFORMCPEDGE_PACKAGE_SPEC.md` and `REUSABLE_MCP_EDGE_LIBRARY_PLAN.md`.

Status legend:
- PASS: implemented and covered by code/tests/docs.
- PARTIAL: implemented but incomplete operational/test coverage.
- FAIL: not implemented.

## A. Package Goal and Scope

| ID | Requirement | Evidence (Code/Docs/Tests) | Status | Notes |
|---|---|---|---|---|
| A-01 | Provide generic reusable versioned AMQP execution-channel package | `package.json`, `README.md`, contracts and runtime modules | PASS | Reusable package structure present |
| A-02 | Responsible for typed job envelopes | `src/contracts/jobs.ts`, `src/contracts/envelopes.ts` | PASS | Typed and schema-validated |
| A-03 | Responsible for typed ack/progress/result/failure events | `src/contracts/events.ts` | PASS | Typed and schema-validated |
| A-04 | Responsible for broker-facing consumer/publisher primitives | `src/consumer/edge-job-consumer.ts`, `src/publisher/edge-event-publisher.ts` | PASS | Live AMQP and mock support |
| A-05 | Responsible for routing and namespace conventions | `src/config/index.ts` (`buildRoutingKey`, exchanges) | PASS | Edge namespace separated |
| A-06 | Responsible for schema validation and compatibility metadata | `src/contracts/index.ts`, `src/contracts/compatibility.ts` | PASS | Runtime enforcement added in consumer/publisher |
| A-07 | Responsible for reusable health and testing helpers | `src/health/health.ts`, `src/testing/mock-edge-channel.ts` | PASS | Helper and mock channel available |
| A-08 | Not responsible for MCP Transport implementation | `README.md` non-goals, no transport code | PASS | Enforced by package boundaries |
| A-09 | Not responsible for JSON-RPC semantics | `README.md` non-goals, no JSON-RPC contracts | PASS | No JSON-RPC fields/flows |
| A-10 | Not responsible for control-plane business logic | `README.md`, runtime APIs | PASS | Generic execution-channel library |
| A-11 | Not responsible for server-specific execution code | Generic interfaces and mocks | PASS | No server-specific coupling |

## B. Package Identity and Public Modules

| ID | Requirement | Evidence (Code/Docs/Tests) | Status | Notes |
|---|---|---|---|---|
| B-01 | Recommended package name `@mcp-edge/amqp` | `package.json`, spec, `README.md` | PASS | Scoped package identity aligned across metadata and docs |
| B-02 | Repository name recommendation | Current repository name | PASS | Matches recommendation |
| B-03 | Public module layout includes config/contracts/consumer/publisher/connection/health/testing | `src/*/index.ts`, `package.json` exports | PASS | All modules exported |
| B-04 | Source layout matches recommended structure | `src/` tree | PASS | Layout aligned |

## C. Public Exports

| ID | Requirement | Evidence (Code/Docs/Tests) | Status | Notes |
|---|---|---|---|---|
| C-01 | Export `EdgeChannelConfig` | `src/index.ts` | PASS | Exported |
| C-02 | Export `ExchangeConfig` | `src/index.ts` | PASS | Exported |
| C-03 | Export `QueueNamingStrategy` | `src/index.ts` | PASS | Exported |
| C-04 | Export `RoutingKeyStrategy` | `src/index.ts` | PASS | Exported |
| C-05 | Export `validateConfig` | `src/index.ts` | PASS | Exported |
| C-06 | Export `BaseEdgeEnvelope` and envelope types | `src/index.ts`, `src/contracts/index.ts` | PASS | Exported |
| C-07 | Export compatibility metadata and envelope version/message type | `src/index.ts` | PASS | Exported |
| C-08 | Export `TargetSelector`, `ExecutionAttemptMetadata` | `src/index.ts` | PASS | Exported |
| C-09 | Export runtime primitives consumer/publisher/connection/createEdgeChannel | `src/index.ts`, `src/connection/index.ts` | PASS | Exported |
| C-10 | Export `buildRoutingKey` and `validateEnvelope` | `src/index.ts` | PASS | Exported |
| C-11 | Export `createMockEdgeChannel` | `src/index.ts`, `src/testing/index.ts` | PASS | Exported |

## D. Core Interfaces

| ID | Requirement | Evidence (Code/Docs/Tests) | Status | Notes |
|---|---|---|---|---|
| D-01 | Consumer interface start/stop/onJob/ack/nack/health | `src/consumer/edge-job-consumer.ts` | PASS | Implemented |
| D-02 | Publisher interface publishAck/progress/result/failure/health | `src/publisher/edge-event-publisher.ts` | PASS | Implemented |
| D-03 | Composition interface `EdgeChannel` and `createEdgeChannel` | `src/connection/index.ts` | PASS | Implemented |

## E. Envelope and Contract Semantics

| ID | Requirement | Evidence (Code/Docs/Tests) | Status | Notes |
|---|---|---|---|---|
| E-01 | `specVersion: '1.0'` base envelope | `src/contracts/envelopes.ts` | PASS | Enforced via zod literal |
| E-02 | Base envelope core fields (`messageId`, `timestamp`, `producer`, `compatibility`, `payload`) | `src/contracts/envelopes.ts` | PASS | Enforced |
| E-03 | Supported message types: job/ack/progress/result/failure | `src/contracts/envelopes.ts`, tests | PASS | Enforced and tested |
| E-04 | Execution job payload fields and capability kinds | `src/contracts/jobs.ts` | PASS | Enforced |
| E-05 | Target selector fields | `src/contracts/jobs.ts` | PASS | Enforced |
| E-06 | Ack payload fields | `src/contracts/events.ts` | PASS | Enforced |
| E-07 | Progress payload fields and state enum | `src/contracts/events.ts` | PASS | Enforced |
| E-08 | Result payload fields/artifacts | `src/contracts/events.ts` | PASS | Enforced |
| E-09 | Failure payload fields | `src/contracts/events.ts` | PASS | Enforced |

## F. Routing and Namespace Rules

| ID | Requirement | Evidence (Code/Docs/Tests) | Status | Notes |
|---|---|---|---|---|
| F-01 | Default jobs exchange `mcp.edge.jobs` | `src/config/index.ts` | PASS | Implemented |
| F-02 | Default events exchange `mcp.edge.events` | `src/config/index.ts` | PASS | Implemented |
| F-03 | Default DLX `mcp.edge.dlx` | `src/config/index.ts` | PASS | Implemented |
| F-04 | Job routing pattern `edge.job.<site>.<node/group>.<kind>.<name>` | `src/config/index.ts` | PASS | Implemented with sanitization |
| F-05 | Event routing patterns ack/progress/result/failure | `src/config/index.ts` | PASS | Implemented |
| F-06 | Job/event routing separate from transport namespaces | `src/config/index.ts`, `src/__tests__/edge-library.test.ts` | PASS | Verified by tests |
| F-07 | Queue naming supports per-site and per-node isolation | `src/config/index.ts` (`buildConsumerQueueName`) | PASS | Supports site/node/nodeGroup |

## G. Versioning and Compatibility Rules

| ID | Requirement | Evidence (Code/Docs/Tests) | Status | Notes |
|---|---|---|---|---|
| G-01 | `specVersion` only for breaking envelope changes | `docs/RELEASE_POLICY.md` | PASS | Policy documented |
| G-02 | Additive fields are minor compatible | `docs/RELEASE_POLICY.md`, `.passthrough()` schemas | PASS | Compatible by policy + parser |
| G-03 | Consumers ignore unknown additive fields | `.passthrough()` across schemas | PASS | Unknown fields accepted |
| G-04 | Breaking semantic changes require new `specVersion` | `docs/RELEASE_POLICY.md` | PASS | Policy documented |
| G-05 | Publishers may require minimum consumer versions | `src/contracts/compatibility.ts`, runtime checks | PASS | Runtime checks now enforced |

## H. Testing Requirements

| ID | Requirement | Evidence (Code/Docs/Tests) | Status | Notes |
|---|---|---|---|---|
| H-01 | Envelope validation for all public message types | `src/__tests__/edge-library.test.ts` | PASS | Covered |
| H-02 | Routing-key generation and namespace separation | `src/__tests__/edge-library.test.ts` | PASS | Covered |
| H-03 | Consumer ack/nack semantics | `src/__tests__/edge-library.test.ts`, integration requeue test | PASS | Covered |
| H-04 | Publication of ack/progress/result/failure events | `src/__tests__/edge-library.test.ts`, `src/__tests__/rabbitmq.integration.test.ts` | PASS | Covered |
| H-05 | Compatibility validation behavior | `src/__tests__/edge-library.test.ts` | PARTIAL | Basic unit check exists, runtime-path strict checks need expanded tests |
| H-06 | Mock-broker round trips without MCP transport imports | `src/testing/mock-edge-channel.ts`, unit tests | PASS | Covered |

## I. Consumer/Producer Expectations and Multi-Consumer Reuse

| ID | Requirement | Evidence (Code/Docs/Tests) | Status | Notes |
|---|---|---|---|---|
| I-01 | Supports expected producers/consumers without protocol leakage | Generic contracts and APIs | PASS | No server-specific references in runtime |
| I-02 | Can be reused by future edge runtimes | Generic package/public APIs | PASS | Reusable abstractions maintained |

## J. Plan-Derived Reusable Foundations

| ID | Requirement | Evidence (Code/Docs/Tests) | Status | Notes |
|---|---|---|---|---|
| J-01 | Connection lifecycle and reconnect/recovery patterns | `src/connection/connection-manager.ts`, consumer reconnect hook | PARTIAL | Initial implementation complete; reconnect tests pending |
| J-02 | Safe ack/nack handling | `src/consumer/edge-job-consumer.ts`, integration tests | PASS | Implemented |
| J-03 | Validation utilities and config validation | `src/contracts/*`, `src/config/index.ts` | PASS | Implemented |
| J-04 | Routing strategy patterns | `src/config/index.ts` | PASS | Implemented |
| J-05 | Max message size checks | `src/consumer/edge-job-consumer.ts` | PASS | Oversized payload nacked |
| J-06 | Credential-redaction practices | N/A in current logs/output | PARTIAL | No explicit redaction utility yet |
| J-07 | Backpressure hooks | `src/publisher/edge-event-publisher.ts` | PARTIAL | Drain wait added; no dedicated stress tests yet |
| J-08 | Compatibility slice with marketplace and edge runtime | Integration tests use generic job/event cycle | PARTIAL | Simulated generic compatibility, no external repo contract test |

## K. Release and Governance Rules

| ID | Requirement | Evidence (Code/Docs/Tests) | Status | Notes |
|---|---|---|---|---|
| K-01 | Semver package releases | `docs/RELEASE_POLICY.md` | PASS | Documented |
| K-02 | Changelog entry for contract-affecting changes | `CHANGELOG.md` | PASS | Present |
| K-03 | Migration notes for breaking changes | `docs/RELEASE_POLICY.md` | PASS | Policy requires migration notes |

## Current Remediation Roll-Up

- Finding 1: PARTIAL (code added; reconnect behavior tests pending).
- Finding 2: PARTIAL (code added in runtime paths; strict test cases pending).
- Finding 3: PARTIAL (drain handling added; stress/backpressure tests pending).
- Finding 4: PARTIAL (build split added; packaging validation pending after script changes).
- Finding 5: PARTIAL (scoped package identity updated in metadata/docs; downstream migration notes pending).
