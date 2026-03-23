import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { buildRoutingKey, createMockEdgeChannel, EdgeEventPublisher, EdgeJobConsumer, validateCompatibility, validateEnvelope } from '../index.js';
import { createAckMessage, createBaseEnvelope, createExecutionJob, createFailureMessage, createProgressMessage, createResultMessage } from './fixtures.js';

class FakeConsumerChannel {
  public consumeCount = 0;

  public bindCount = 0;

  public cancelledTags: string[] = [];

  public nackCount = 0;

  public lastNackDeliveryTag?: number;

  private consumeHandler?: (message: { fields: { deliveryTag: number; routingKey: string; redelivered: boolean }; content: Buffer } | null) => void;

  public ack(): void {
    // no-op for test double
  }

  public nack(message: { fields: { deliveryTag: number } }): void {
    this.nackCount += 1;
    this.lastNackDeliveryTag = message.fields.deliveryTag;
  }

  public async assertExchange(): Promise<void> {
    // no-op for test double
  }

  public async prefetch(): Promise<void> {
    // no-op for test double
  }

  public async assertQueue(): Promise<void> {
    // no-op for test double
  }

  public async bindQueue(): Promise<void> {
    this.bindCount += 1;
  }

  public async consume(
    _queueName: string,
    handler: (message: { fields: { deliveryTag: number; routingKey: string; redelivered: boolean }; content: Buffer } | null) => void,
    _options?: { consumerTag?: string },
  ): Promise<{ consumerTag: string }> {
    this.consumeCount += 1;
    this.consumeHandler = handler;
    return {
      consumerTag: `ctag-${this.consumeCount}`,
    };
  }

  public async cancel(consumerTag: string): Promise<void> {
    this.cancelledTags.push(consumerTag);
  }

  public emitMessage(message: { fields: { deliveryTag: number; routingKey: string; redelivered: boolean }; content: Buffer }): void {
    assert.ok(this.consumeHandler, 'expected consume handler to be registered');
    this.consumeHandler(message);
  }
}

class FakeConsumerConnectionManager {
  private reconnectHandler?: () => Promise<void>;

  public constructor(private readonly channel: FakeConsumerChannel) {}

  public onReconnect(handler: () => Promise<void>): () => void {
    this.reconnectHandler = handler;
    return () => {
      if (this.reconnectHandler === handler) {
        this.reconnectHandler = undefined;
      }
    };
  }

  public async getConsumerChannel(): Promise<FakeConsumerChannel> {
    return this.channel;
  }

  public async health(): Promise<{ connected: boolean; consumerActive: boolean; publisherActive: boolean }> {
    return {
      connected: true,
      consumerActive: true,
      publisherActive: true,
    };
  }

  public async triggerReconnect(): Promise<void> {
    assert.ok(this.reconnectHandler, 'expected reconnect handler to be registered');
    await this.reconnectHandler();
  }
}

class FakePublisherChannel extends EventEmitter {
  public publishCalls = 0;

  public constructor(private readonly accepted: boolean) {
    super();
  }

  public async assertExchange(): Promise<void> {
    // no-op for test double
  }

  public publish(): boolean {
    this.publishCalls += 1;
    return this.accepted;
  }
}

class FakePublisherConnectionManager {
  public constructor(private readonly channel: FakePublisherChannel) {}

  public async getPublisherChannel(): Promise<FakePublisherChannel> {
    return this.channel;
  }

  public async health(): Promise<{ connected: boolean; consumerActive: boolean; publisherActive: boolean }> {
    return {
      connected: true,
      consumerActive: true,
      publisherActive: true,
    };
  }
}

test('validateEnvelope accepts all public message types', () => {
  const jobEnvelope = createExecutionJob();
  const ackMessage = createAckMessage();
  const progressMessage = createProgressMessage();
  const resultMessage = createResultMessage();
  const failureMessage = createFailureMessage();

  assert.equal(validateEnvelope(jobEnvelope).messageType, 'execution.job');
  assert.equal(validateEnvelope(ackMessage).messageType, 'execution.ack');
  assert.equal(validateEnvelope(progressMessage).messageType, 'execution.progress');
  assert.equal(validateEnvelope(resultMessage).messageType, 'execution.result');
  assert.equal(validateEnvelope(failureMessage).messageType, 'execution.failure');
});

test('buildRoutingKey keeps job and event namespaces separate', () => {
  const jobRoutingKey = buildRoutingKey('execution.job', {
    siteId: 'site-a',
    nodeId: 'node-1',
    capabilityKind: 'tool',
    capabilityName: 'search.documents',
  });
  const resultRoutingKey = buildRoutingKey('execution.result', {
    siteId: 'site-a',
    nodeId: 'node-1',
  });

  assert.equal(jobRoutingKey, 'edge.job.site-a.node-1.tool.search-documents');
  assert.equal(resultRoutingKey, 'edge.event.result.site-a.node-1');
});

test('validateCompatibility reports minimum version mismatches', () => {
  const result = validateCompatibility(
    {
      channelVersion: '0.1.0',
      minConsumerVersion: '1.2.0',
    },
    {
      consumerVersion: '1.1.0',
    },
  );

  assert.equal(result.compatible, false);
  assert.match(result.reasons[0] ?? '', /consumer version/);
});

test('mock edge channel supports job dispatch, ack, and event publication', async () => {
  const channel = createMockEdgeChannel({
    siteId: 'site-a',
    nodeId: 'node-1',
  });
  const jobEnvelope = createExecutionJob();

  await channel.consumer.start();

  channel.consumer.onJob(async (job, delivery) => {
    await channel.publisher.publishAck({
      ...createAckMessage({
        messageId: 'ack-message-2',
        payload: {
          jobId: job.payload.jobId,
          attemptId: job.payload.attemptId,
          siteId: 'site-a',
          nodeId: 'node-1',
          accepted: true,
        },
      }),
    });

    await channel.publisher.publishProgress({
      ...createProgressMessage({
        messageId: 'progress-message-2',
        payload: {
          jobId: job.payload.jobId,
          attemptId: job.payload.attemptId,
          siteId: 'site-a',
          nodeId: 'node-1',
          state: 'running',
          percent: 80,
        },
      }),
    });

    await channel.publisher.publishResult({
      ...createResultMessage({
        messageId: 'result-message-2',
        payload: {
          jobId: job.payload.jobId,
          attemptId: job.payload.attemptId,
          siteId: 'site-a',
          nodeId: 'node-1',
          completedAt: new Date().toISOString(),
          output: {
            documents: ['a', 'b'],
          },
        },
      }),
    });

    await channel.consumer.ack(delivery);
  });

  const delivery = await channel.dispatchJob(jobEnvelope);
  const deliveries = channel.getDeliveries();
  const publishedEvents = channel.getPublishedEvents();

  assert.equal(delivery.deliveryTag, 1);
  assert.equal(deliveries[0]?.status, 'acked');
  assert.deepEqual(
    publishedEvents.map((event) => event.message.messageType),
    ['execution.ack', 'execution.progress', 'execution.result'],
  );

  await channel.close();
});

test('edge consumer re-initializes subscription after reconnect', async () => {
  const channel = new FakeConsumerChannel();
  const connectionManager = new FakeConsumerConnectionManager(channel);

  const consumer = new EdgeJobConsumer(
    {
      amqpUrl: 'amqp://test.local',
      siteId: 'site-a',
      nodeId: 'node-1',
    },
    connectionManager as never,
  );

  await consumer.start();
  assert.equal(channel.consumeCount, 1);

  await connectionManager.triggerReconnect();

  assert.equal(channel.consumeCount, 2);
  assert.deepEqual(channel.cancelledTags, ['ctag-1']);

  await consumer.stop();
});

test('publisher waits for drain when broker applies backpressure', async () => {
  const channel = new FakePublisherChannel(false);
  const connectionManager = new FakePublisherConnectionManager(channel);

  const publisher = new EdgeEventPublisher(
    {
      amqpUrl: 'amqp://test.local',
      siteId: 'site-a',
      nodeId: 'node-1',
      backpressureTimeoutMs: 200,
    },
    connectionManager as never,
  );

  const publishPromise = publisher.publishAck(createAckMessage());

  setTimeout(() => {
    channel.emit('drain');
  }, 20);

  await publishPromise;
  assert.equal(channel.publishCalls, 1);
});

test('publisher fails when drain event does not arrive before timeout', async () => {
  const channel = new FakePublisherChannel(false);
  const connectionManager = new FakePublisherConnectionManager(channel);

  const publisher = new EdgeEventPublisher(
    {
      amqpUrl: 'amqp://test.local',
      siteId: 'site-a',
      nodeId: 'node-1',
      backpressureTimeoutMs: 25,
    },
    connectionManager as never,
  );

  await assert.rejects(
    () => publisher.publishAck(createAckMessage()),
    /publisher backpressure timeout/,
  );
});

test('consumer rejects job when minConsumerVersion is set but runtimeConsumerVersion is missing', async () => {
  const channel = new FakeConsumerChannel();
  const connectionManager = new FakeConsumerConnectionManager(channel);

  const consumer = new EdgeJobConsumer(
    {
      amqpUrl: 'amqp://test.local',
      siteId: 'site-a',
      nodeId: 'node-1',
    },
    connectionManager as never,
  );

  let handled = false;
  consumer.onJob(async () => {
    handled = true;
  });

  await consumer.start();

  const jobEnvelope = createExecutionJob({
    compatibility: {
      ...createBaseEnvelope().compatibility,
      minConsumerVersion: '1.0.0',
    },
  });

  channel.emitMessage({
    fields: {
      deliveryTag: 101,
      routingKey: 'edge.job.site-a.node-1.tool.search-documents',
      redelivered: false,
    },
    content: Buffer.from(JSON.stringify(jobEnvelope), 'utf8'),
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(handled, false);
  assert.equal(channel.nackCount, 1);
  assert.equal(channel.lastNackDeliveryTag, 101);

  await consumer.stop();
});

test('consumer rejects job when runtimeConsumerVersion is below minConsumerVersion', async () => {
  const channel = new FakeConsumerChannel();
  const connectionManager = new FakeConsumerConnectionManager(channel);

  const consumer = new EdgeJobConsumer(
    {
      amqpUrl: 'amqp://test.local',
      siteId: 'site-a',
      nodeId: 'node-1',
      runtimeConsumerVersion: '0.9.0',
    },
    connectionManager as never,
  );

  let handled = false;
  consumer.onJob(async () => {
    handled = true;
  });

  await consumer.start();

  const jobEnvelope = createExecutionJob({
    compatibility: {
      ...createBaseEnvelope().compatibility,
      minConsumerVersion: '1.0.0',
    },
  });

  channel.emitMessage({
    fields: {
      deliveryTag: 102,
      routingKey: 'edge.job.site-a.node-1.tool.search-documents',
      redelivered: false,
    },
    content: Buffer.from(JSON.stringify(jobEnvelope), 'utf8'),
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(handled, false);
  assert.equal(channel.nackCount, 1);
  assert.equal(channel.lastNackDeliveryTag, 102);

  await consumer.stop();
});

test('publisher rejects event when minProducerVersion is set but runtimeProducerVersion is missing', async () => {
  const channel = new FakePublisherChannel(true);
  const connectionManager = new FakePublisherConnectionManager(channel);

  const publisher = new EdgeEventPublisher(
    {
      amqpUrl: 'amqp://test.local',
      siteId: 'site-a',
      nodeId: 'node-1',
    },
    connectionManager as never,
  );

  await assert.rejects(
    () =>
      publisher.publishAck(
        createAckMessage({
          compatibility: {
            ...createBaseEnvelope().compatibility,
            minProducerVersion: '1.0.0',
          },
        }),
      ),
    /producerVersion is required/,
  );

  assert.equal(channel.publishCalls, 0);
});

test('publisher rejects event when runtimeProducerVersion is below minProducerVersion', async () => {
  const channel = new FakePublisherChannel(true);
  const connectionManager = new FakePublisherConnectionManager(channel);

  const publisher = new EdgeEventPublisher(
    {
      amqpUrl: 'amqp://test.local',
      siteId: 'site-a',
      nodeId: 'node-1',
      runtimeProducerVersion: '0.9.0',
    },
    connectionManager as never,
  );

  await assert.rejects(
    () =>
      publisher.publishAck(
        createAckMessage({
          compatibility: {
            ...createBaseEnvelope().compatibility,
            minProducerVersion: '1.0.0',
          },
        }),
      ),
    /producer version 0.9.0 is lower than required 1.0.0/,
  );

  assert.equal(channel.publishCalls, 0);
});