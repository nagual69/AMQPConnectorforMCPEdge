# @mcp-edge/amqp

Reusable AMQP edge execution library for MCP worker deployments.

This package provides versioned job and event contracts, routing helpers, AMQP consumer and publisher primitives, compatibility validation, and in-memory testing helpers for edge execution flows.

## Scope

This library is responsible for:

- typed execution job envelopes
- typed ack, progress, result, and failure event envelopes
- broker-facing consumer and publisher primitives
- routing and queue naming conventions for edge execution traffic
- envelope and compatibility validation
- reusable health and mock testing helpers

This library does not implement:

- MCP Transport
- JSON-RPC request or response semantics
- reply-queue driven execution flows
- control-plane business logic
- server-specific worker behavior

## Installation

```bash
npm install @mcp-edge/amqp
```

## Public Modules

- `@mcp-edge/amqp/config`
- `@mcp-edge/amqp/contracts`
- `@mcp-edge/amqp/consumer`
- `@mcp-edge/amqp/publisher`
- `@mcp-edge/amqp/connection`
- `@mcp-edge/amqp/health`
- `@mcp-edge/amqp/testing`

## Quick Start

```ts
import { createEdgeChannel } from '@mcp-edge/amqp';

const channel = await createEdgeChannel({
  amqpUrl: 'amqp://localhost:5672',
  siteId: 'site-a',
  nodeId: 'node-1',
});

channel.consumer.onJob(async (job, delivery) => {
  await channel.publisher.publishProgress({
    specVersion: '1.0',
    messageType: 'execution.progress',
    messageId: 'msg-progress-1',
    timestamp: new Date().toISOString(),
    producer: {
      service: 'edge-worker',
      version: '0.1.0',
    },
    compatibility: {
      channelVersion: '0.1.0',
      packageVersion: '0.1.0',
    },
    payload: {
      jobId: job.payload.jobId,
      attemptId: job.payload.attemptId,
      siteId: 'site-a',
      nodeId: 'node-1',
      state: 'running',
      percent: 25,
      message: 'Tool execution started',
    },
  });

  await channel.consumer.ack(delivery);
});

await channel.consumer.start();
```

## Contracts-Only Example

```ts
import type { ExecutionJobEnvelope } from '@mcp-edge/amqp/contracts';
import { validateEnvelope } from '@mcp-edge/amqp/contracts';

const job: ExecutionJobEnvelope = {
  specVersion: '1.0',
  messageType: 'execution.job',
  messageId: 'msg-job-1',
  timestamp: new Date().toISOString(),
  producer: {
    service: 'control-plane',
    version: '1.2.0',
  },
  compatibility: {
    channelVersion: '0.1.0',
    minConsumerVersion: '0.1.0',
  },
  payload: {
    jobId: 'job-1',
    attemptId: 'attempt-1',
    idempotencyKey: 'job-1-attempt-1',
    timeoutMs: 30000,
    target: {
      siteId: 'site-a',
      nodeId: 'node-1',
    },
    createdBy: {
      controlPlane: 'mcp-od-marketplace',
    },
    capability: {
      kind: 'tool',
      name: 'search.documents',
      version: '2026-03',
    },
    input: {
      query: 'recent jobs',
    },
  },
};

validateEnvelope(job);
```

## Testing

The package includes an in-memory mock edge channel for unit tests and contract walkthroughs.

```ts
import { createMockEdgeChannel } from '@mcp-edge/amqp/testing';

const mockChannel = createMockEdgeChannel({ siteId: 'site-a', nodeId: 'node-1' });
```

## Environment Setup

Use the repository env files as follows:

- `.env.example`: committed template that documents expected variables and safe defaults.
- `.env.local`: your machine-specific overrides (credentials, alternate broker URL), ignored by git.

Environment variables used by this repository:

- `AMQP_INTEGRATION_URL`: used by integration tests.
- `AMQP_EXAMPLE_URL`: used by `npm run example:rabbitmq`.

Typical setup flow:

1. Start from the values in `.env.example`.
2. Put your local values in `.env.local`.
3. Override in-shell env vars only when you need a one-off run.

### Real RabbitMQ Integration

You can run the integration test suite against a live RabbitMQ broker.

Default broker URL:

```bash
amqp://mcp:discovery@127.0.0.1:5672
```

Start a local broker:

```bash
npm run docker:rabbitmq:up
```

Run unit and integration tests:

```bash
npm run test:unit
npm run test:integration
```

On PowerShell, load the local RabbitMQ defaults for your current session:

```powershell
. .\scripts\Use-LocalRabbitMQ.ps1
```

Override the broker URL when needed:

```bash
set AMQP_INTEGRATION_URL=amqp://mcp:discovery@127.0.0.1:5672
npm run test:integration
```

The integration script checks `AMQP_INTEGRATION_URL` first, then falls back to local defaults (`mcp:discovery` first, then `guest:guest`).

The integration suite includes:

- a successful job lifecycle test
- a failure-and-requeue test that verifies `nack(..., { requeue: true })` produces redelivery

## End-To-End RabbitMQ Example

The repository includes a richer example that simulates:

- a control-plane publisher sending an `execution.job`
- an edge worker consuming the job through this library
- the worker publishing ack, progress, and result events
- a control-plane listener consuming those events from RabbitMQ

Run it with:

```bash
npm run example:rabbitmq
```

Override the broker URL for the example when needed:

```bash
set AMQP_EXAMPLE_URL=amqp://mcp:discovery@127.0.0.1:5672
npm run example:rabbitmq
```

The example script lives in `examples/end-to-end-rabbitmq.mjs` and uses a live broker rather than the mock channel.

## Release Files

- `CHANGELOG.md` tracks released and unreleased changes.
- `docs/RELEASE_POLICY.md` defines the first-publish and ongoing release rules.

## Publish Readiness

Package publish metadata is defined in `package.json`:

- repository, homepage, and issue tracker links
- `publishConfig.access = public`
- `publishConfig.provenance = true`

Run a first-release readiness check with:

```bash
npm run release:check
```

## Development

```bash
npm install
npm run build
npm test
```