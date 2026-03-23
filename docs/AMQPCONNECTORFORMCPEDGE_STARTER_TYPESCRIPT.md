## AMQPConnectorforMCPEdge Starter TypeScript Bootstrap

This document exists to bootstrap the new repository's AI and first implementation pass. It is intentionally code-shaped documentation rather than production code.

Use this as the initial skeleton when creating the new `AMQPConnectorforMCPEdge` project.

## Recommended Initial Files

```text
package.json
tsconfig.json
README.md
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

## Starter `package.json`

```json
{
  "name": "amqp-mcp-edge",
  "version": "0.1.0",
  "description": "Reusable AMQP edge execution library for MCP worker deployments",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "npm run build"
  },
  "dependencies": {
    "amqplib": "^0.10.8",
    "zod": "^3.25.64"
  },
  "devDependencies": {
    "@types/amqplib": "^0.10.7",
    "@types/node": "^22.0.0",
    "typescript": "^5.8.0"
  }
}
```

## Starter `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "declaration": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"]
}
```

## Starter Public Types

Put the following interfaces into `src/contracts/` as the first implementation pass.

`src/contracts/compatibility.ts`

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

`src/contracts/envelopes.ts`

```ts
import type { CompatibilityMetadata } from './compatibility.js';

export type EdgeMessageType =
  | 'execution.job'
  | 'execution.ack'
  | 'execution.progress'
  | 'execution.result'
  | 'execution.failure';

export type MessageEnvelopeVersion = '1.0';

export interface BaseEdgeEnvelope<TType extends EdgeMessageType, TPayload> {
  specVersion: MessageEnvelopeVersion;
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

`src/contracts/jobs.ts`

```ts
import type { BaseEdgeEnvelope } from './envelopes.js';

export interface TargetSelector {
  siteId?: string;
  nodeId?: string;
  nodeGroup?: string;
  capabilityTags?: string[];
}

export interface ExecutionJobPayload {
  jobId: string;
  attemptId: string;
  idempotencyKey: string;
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

`src/contracts/events.ts`

```ts
import type { BaseEdgeEnvelope } from './envelopes.js';

export interface JobAckPayload {
  jobId: string;
  attemptId: string;
  nodeId: string;
  accepted: boolean;
  reason?: string;
}

export interface JobProgressPayload {
  jobId: string;
  attemptId: string;
  nodeId: string;
  state: 'received' | 'started' | 'running' | 'waiting' | 'finishing';
  percent?: number;
  message?: string;
  metrics?: Record<string, number>;
}

export interface JobResultPayload {
  jobId: string;
  attemptId: string;
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

export interface JobFailurePayload {
  jobId: string;
  attemptId: string;
  nodeId: string;
  failedAt: string;
  retryable: boolean;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type JobAckMessage = BaseEdgeEnvelope<'execution.ack', JobAckPayload>;
export type JobProgressEvent = BaseEdgeEnvelope<'execution.progress', JobProgressPayload>;
export type JobResultEvent = BaseEdgeEnvelope<'execution.result', JobResultPayload>;
export type JobFailureEvent = BaseEdgeEnvelope<'execution.failure', JobFailurePayload>;
```

## Starter Runtime Interfaces

`src/config/index.ts`

```ts
export interface EdgeChannelConfig {
  amqpUrl: string;
  jobsExchange: string;
  eventsExchange: string;
  deadLetterExchange?: string;
  siteId?: string;
  nodeId?: string;
  consumerQueueName?: string;
  prefetchCount?: number;
}

export function validateConfig(config: EdgeChannelConfig): string[] {
  const errors: string[] = [];
  if (!config.amqpUrl) errors.push('amqpUrl is required');
  if (!config.jobsExchange) errors.push('jobsExchange is required');
  if (!config.eventsExchange) errors.push('eventsExchange is required');
  return errors;
}
```

`src/consumer/edge-job-consumer.ts`

```ts
import type { ExecutionJobEnvelope } from '../contracts/jobs.js';

export interface JobDeliveryContext {
  deliveryTag?: number;
  routingKey?: string;
  redelivered?: boolean;
}

export interface EdgeChannelHealth {
  connected: boolean;
  consumerActive?: boolean;
  publisherActive?: boolean;
  timestamp: string;
}

export interface EdgeJobConsumer {
  start(): Promise<void>;
  stop(): Promise<void>;
  onJob(handler: (job: ExecutionJobEnvelope, context: JobDeliveryContext) => Promise<void>): void;
  ack(delivery: JobDeliveryContext): Promise<void>;
  nack(delivery: JobDeliveryContext, options?: { requeue?: boolean; reason?: string }): Promise<void>;
  health(): Promise<EdgeChannelHealth>;
}
```

`src/publisher/edge-event-publisher.ts`

```ts
import type {
  JobAckMessage,
  JobProgressEvent,
  JobResultEvent,
  JobFailureEvent,
} from '../contracts/events.js';
import type { EdgeChannelHealth } from '../consumer/edge-job-consumer.js';

export interface EdgeEventPublisher {
  publishAck(message: JobAckMessage): Promise<void>;
  publishProgress(message: JobProgressEvent): Promise<void>;
  publishResult(message: JobResultEvent): Promise<void>;
  publishFailure(message: JobFailureEvent): Promise<void>;
  health(): Promise<EdgeChannelHealth>;
}
```

`src/index.ts`

```ts
export type { EdgeChannelConfig } from './config/index.js';
export { validateConfig } from './config/index.js';

export type { CompatibilityMetadata } from './contracts/compatibility.js';
export type { BaseEdgeEnvelope, EdgeMessageType, MessageEnvelopeVersion } from './contracts/envelopes.js';
export type { TargetSelector, ExecutionJobPayload, ExecutionJobEnvelope } from './contracts/jobs.js';
export type {
  JobAckPayload,
  JobProgressPayload,
  JobResultPayload,
  JobFailurePayload,
  JobAckMessage,
  JobProgressEvent,
  JobResultEvent,
  JobFailureEvent,
} from './contracts/events.js';

export type { JobDeliveryContext, EdgeChannelHealth, EdgeJobConsumer } from './consumer/edge-job-consumer.js';
export type { EdgeEventPublisher } from './publisher/edge-event-publisher.js';
```

## AI Bootstrap Guidance

When using AI to scaffold the new repository, keep these rules explicit:
- do not implement MCP `Transport`
- do not use JSON-RPC envelopes
- do not use `replyTo` as the core response model
- prefer explicit typed job and event envelopes
- keep package exports generic and reusable across multiple MCP runtimes
- keep queue naming and routing conventions separate from `AMQPConnectorforMCP`
- write mocked broker tests before real broker integration

## First Implementation Milestone

The first development milestone should produce:
1. package skeleton and build
2. exported contract types
3. config validation
4. stub consumer and publisher interfaces
5. mock channel helpers
6. one documented end-to-end example using the contracts only

## Related Documents

- `docs/REUSABLE_MCP_EDGE_LIBRARY_PLAN.md`
- `docs/AMQPCONNECTORFORMCPEDGE_PACKAGE_SPEC.md`
- `docs/EDGE_RUNTIME_PLAN.md`
- `docs/CONTROL_PLANE_PLAN.md`