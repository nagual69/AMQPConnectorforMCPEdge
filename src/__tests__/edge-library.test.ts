import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRoutingKey, createMockEdgeChannel, validateCompatibility, validateEnvelope } from '../index.js';
import { createAckMessage, createBaseEnvelope, createExecutionJob, createFailureMessage, createProgressMessage, createResultMessage } from './fixtures.js';

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