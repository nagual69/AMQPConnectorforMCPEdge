## AMQPConnectorforMCPEdge Package Specification

This document is the copy-ready package specification for a new repository named `AMQPConnectorforMCPEdge`.

The package should be positioned as a reusable MCP edge execution library for AMQP-based worker deployments, parallel in purpose to `AMQPConnectorforMCP` but intentionally separate in protocol semantics.

## Package Goal

Provide a generic, reusable, versioned AMQP execution-channel package that can be shared across multiple MCP servers with edge deployment patterns.

The package is responsible for:
- typed job envelopes
- typed ack, progress, result, and failure events
- broker-facing consumer/publisher primitives
- routing and namespace conventions
- schema validation and compatibility metadata
- reusable health and testing helpers

The package is not responsible for:
- MCP `Transport` implementation
- JSON-RPC client/server semantics
- control-plane business logic
- package governance logic
- server-specific execution code

## Package Identity

Recommended package name:
- `@mcp-edge/amqp`

Recommended repository name:
- `AMQPConnectorforMCPEdge`

Recommended description:
- Reusable AMQP edge execution library for MCP worker deployments.

## Public Modules

Recommended public module layout:
- `@mcp-edge/amqp/config`
- `@mcp-edge/amqp/contracts`
- `@mcp-edge/amqp/consumer`
- `@mcp-edge/amqp/publisher`
- `@mcp-edge/amqp/connection`
- `@mcp-edge/amqp/health`
- `@mcp-edge/amqp/testing`

Recommended repo source layout:

```text
src/
  index.ts
  config/
    index.ts
  contracts/
    index.ts
    envelopes.ts
    jobs.ts
    events.ts
    compatibility.ts
  consumer/
    index.ts
    edge-job-consumer.ts
  publisher/
    index.ts
    edge-event-publisher.ts
  connection/
    index.ts
    connection-manager.ts
  health/
    index.ts
    health.ts
  testing/
    index.ts
    mock-edge-channel.ts
```

## Public Exports

Recommended config exports:
- `EdgeChannelConfig`
- `ExchangeConfig`
- `QueueNamingStrategy`
- `RoutingKeyStrategy`
- `validateConfig`

Recommended contract exports:
- `BaseEdgeEnvelope`
- `CompatibilityMetadata`
- `ExecutionJobEnvelope`
- `JobAckMessage`
- `JobProgressEvent`
- `JobResultEvent`
- `JobFailureEvent`
- `TargetSelector`
- `ExecutionAttemptMetadata`
- `EdgeMessageType`
- `MessageEnvelopeVersion`

Recommended runtime exports:
- `EdgeJobConsumer`
- `EdgeEventPublisher`
- `EdgeChannel`
- `EdgeChannelConnectionManager`
- `createEdgeChannel`
- `buildRoutingKey`
- `validateEnvelope`
- `createMockEdgeChannel`

## Core Interfaces

Consumer interface:

```ts
export interface EdgeJobConsumer {
  start(): Promise<void>;
  stop(): Promise<void>;
  onJob(handler: (job: ExecutionJobEnvelope, context: JobDeliveryContext) => Promise<void>): void;
  ack(delivery: JobDeliveryContext): Promise<void>;
  nack(delivery: JobDeliveryContext, options?: { requeue?: boolean; reason?: string }): Promise<void>;
  health(): Promise<EdgeChannelHealth>;
}
```

Publisher interface:

```ts
export interface EdgeEventPublisher {
  publishAck(message: JobAckMessage): Promise<void>;
  publishProgress(message: JobProgressEvent): Promise<void>;
  publishResult(message: JobResultEvent): Promise<void>;
  publishFailure(message: JobFailureEvent): Promise<void>;
  health(): Promise<EdgeChannelHealth>;
}
```

Composition interface:

```ts
export interface EdgeChannel {
  consumer: EdgeJobConsumer;
  publisher: EdgeEventPublisher;
  close(): Promise<void>;
}

export async function createEdgeChannel(config: EdgeChannelConfig): Promise<EdgeChannel>;
```

## Message Envelope Specification

Base envelope:

```ts
export interface BaseEdgeEnvelope<TType extends string, TPayload> {
  specVersion: '1.0';
  messageType: TType;
  messageId: string;
  timestamp: string;
  producer: {
    service: string;
    version: string;
    instanceId?: string;
  };
  compatibility: CompatibilityMetadata;
  payload: TPayload;
}
```

Compatibility metadata:

```ts
export interface CompatibilityMetadata {
  channelVersion: string;
  minConsumerVersion?: string;
  minProducerVersion?: string;
  serverFamily?: string;
  serverVersion?: string;
  packageVersion?: string;
}
```

Supported message types:
- `execution.job`
- `execution.ack`
- `execution.progress`
- `execution.result`
- `execution.failure`

## Job Contract

Execution job payload:

```ts
export interface ExecutionJobPayload {
  jobId: string;
  attemptId: string;
  idempotencyKey: string;
  attempt?: ExecutionAttemptMetadata;
  target: TargetSelector;
  timeoutMs: number;
  createdBy: {
    controlPlane: string;
    actorId?: string;
  };
  capability: {
    kind: 'tool' | 'resource' | 'prompt' | 'task';
    name: string;
    version?: string;
  };
  input: Record<string, unknown>;
  packageAssignment?: {
    packageId: string;
    packageVersion: string;
    releaseId?: string;
  };
}

export type ExecutionJobEnvelope = BaseEdgeEnvelope<'execution.job', ExecutionJobPayload>;
```

Target selector:

```ts
export interface TargetSelector {
  siteId?: string;
  nodeId?: string;
  nodeGroup?: string;
  capabilityTags?: string[];
}
```

## Event Contracts

Ack event:

```ts
export interface JobAckPayload {
  jobId: string;
  attemptId: string;
  siteId?: string;
  nodeId: string;
  accepted: boolean;
  reason?: string;
}

export type JobAckMessage = BaseEdgeEnvelope<'execution.ack', JobAckPayload>;
```

Progress event:

```ts
export interface JobProgressPayload {
  jobId: string;
  attemptId: string;
  siteId?: string;
  nodeId: string;
  state: 'received' | 'started' | 'running' | 'waiting' | 'finishing';
  percent?: number;
  message?: string;
  metrics?: Record<string, number>;
}

export type JobProgressEvent = BaseEdgeEnvelope<'execution.progress', JobProgressPayload>;
```

Result event:

```ts
export interface JobResultPayload {
  jobId: string;
  attemptId: string;
  siteId?: string;
  nodeId: string;
  completedAt: string;
  output: Record<string, unknown>;
  artifacts?: Array<{
    name: string;
    contentType: string;
    uri?: string;
    inlineData?: string;
  }>;
}

export type JobResultEvent = BaseEdgeEnvelope<'execution.result', JobResultPayload>;
```

Failure event:

```ts
export interface JobFailurePayload {
  jobId: string;
  attemptId: string;
  siteId?: string;
  nodeId: string;
  failedAt: string;
  retryable: boolean;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type JobFailureEvent = BaseEdgeEnvelope<'execution.failure', JobFailurePayload>;
```

## Routing And Namespace Rules

Recommended exchange names:
- jobs exchange: `mcp.edge.jobs`
- events exchange: `mcp.edge.events`
- dead-letter exchange: `mcp.edge.dlx`

Recommended routing key patterns:
- job dispatch: `edge.job.<siteId|any>.<nodeId|group|any>.<capabilityKind>.<capabilityName>`
- ack: `edge.event.ack.<siteId>.<nodeId>`
- progress: `edge.event.progress.<siteId>.<nodeId>`
- result: `edge.event.result.<siteId>.<nodeId>`
- failure: `edge.event.failure.<siteId>.<nodeId>`

Rules:
- job and event routing must remain separate from `AMQPConnectorforMCP` routing.
- message contracts must never depend on reply queues.
- queue naming should support per-site and per-node isolation.

## Versioning And Compatibility

Rules:
- `specVersion` changes only for breaking envelope changes.
- additive fields are minor-version compatible.
- consumers must ignore unknown additive fields.
- breaking semantic changes require a new `specVersion`.
- publishers may require minimum consumer versions with `compatibility.minConsumerVersion`.

Recommended release policy:
- semver for package releases
- changelog entry for every contract-affecting change
- explicit migration notes for every breaking `specVersion` change

Runtime enforcement notes:
- compatibility checks are enforced on consumer inbound envelopes before handler execution
- compatibility checks are enforced on publisher outbound envelopes before publish
- strict runtime-version rejection behavior is implemented; dedicated stress/edge-case test coverage remains tracked in remediation and traceability docs

## Testing Requirements

Minimum required tests:
1. envelope validation for all public message types
2. routing-key generation and namespace separation
3. consumer ack/nack semantics
4. publication of ack, progress, result, and failure events
5. compatibility validation behavior
6. mock-broker round trips without importing MCP transport code

Current coverage status:
- PASS: envelope validation for all public message types
- PASS: routing-key generation and namespace separation
- PASS: consumer ack/nack semantics and requeue behavior
- PASS: publication of ack/progress/result/failure events
- PARTIAL: strict runtime-path compatibility rejection scenarios need expanded focused tests
- PARTIAL: reconnect and publisher backpressure stress-path tests are tracked as in-progress remediation

## Consumer Expectations

Expected consumers:
- `mcp_open_discovery_3_0`
- future MCP edge runtimes
- custom worker runtimes built by the same user

Expected producers:
- `mcp-od-marketplace`
- future control planes or orchestrators

## Related Documents

- `docs/REUSABLE_MCP_EDGE_LIBRARY_PLAN.md`
- `docs/EDGE_RUNTIME_PLAN.md`
- `docs/CONTROL_PLANE_PLAN.md`