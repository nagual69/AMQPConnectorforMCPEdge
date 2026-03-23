import type { Options } from 'amqplib';

import type { EdgeMessageType } from '../contracts/index.js';
import type { TargetSelector } from '../contracts/jobs.js';

export interface ExchangeConfig {
  jobsExchange: string;
  eventsExchange: string;
  deadLetterExchange: string;
}

export interface QueueNameInput {
  siteId?: string;
  nodeId?: string;
  nodeGroup?: string;
  explicitName?: string;
}

export interface QueueNamingStrategy {
  buildConsumerQueueName(input: QueueNameInput): string;
}

export interface RoutingKeySelector {
  siteId?: string;
  nodeId?: string;
  nodeGroup?: string;
  capabilityKind?: string;
  capabilityName?: string;
}

export interface RoutingKeyStrategy {
  build(messageType: EdgeMessageType, selector: RoutingKeySelector): string;
}

export interface EdgeChannelConfig {
  amqpUrl: string;
  jobsExchange?: string;
  eventsExchange?: string;
  deadLetterExchange?: string;
  siteId?: string;
  nodeId?: string;
  nodeGroup?: string;
  consumerQueueName?: string;
  consumerQueueOptions?: Options.AssertQueue;
  consumerTag?: string;
  prefetchCount?: number;
  runtimeConsumerVersion?: string;
  runtimeProducerVersion?: string;
  connectionName?: string;
  maxMessageSizeBytes?: number;
  reconnectEnabled?: boolean;
  reconnectDelayMs?: number;
  reconnectMaxDelayMs?: number;
  backpressureTimeoutMs?: number;
  queueNamingStrategy?: QueueNamingStrategy;
  routingKeyStrategy?: RoutingKeyStrategy;
}

export interface ResolvedEdgeChannelConfig extends EdgeChannelConfig {
  jobsExchange: string;
  eventsExchange: string;
  deadLetterExchange: string;
  prefetchCount: number;
  maxMessageSizeBytes: number;
  reconnectEnabled: boolean;
  reconnectDelayMs: number;
  reconnectMaxDelayMs: number;
  backpressureTimeoutMs: number;
}

export const defaultExchangeConfig: ExchangeConfig = {
  jobsExchange: 'mcp.edge.jobs',
  eventsExchange: 'mcp.edge.events',
  deadLetterExchange: 'mcp.edge.dlx',
};

function sanitizeRoutingSegment(value: string | undefined): string {
  if (!value) {
    return 'any';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_.]/g, '-')
    .replace(/\.+/g, '-');
}

export const defaultQueueNamingStrategy: QueueNamingStrategy = {
  buildConsumerQueueName(input: QueueNameInput): string {
    if (input.explicitName) {
      return input.explicitName;
    }

    const siteId = sanitizeRoutingSegment(input.siteId);
    const worker = sanitizeRoutingSegment(input.nodeId ?? input.nodeGroup);
    return `mcp.edge.consumer.${siteId}.${worker}`;
  },
};

export const defaultRoutingKeyStrategy: RoutingKeyStrategy = {
  build(messageType: EdgeMessageType, selector: RoutingKeySelector): string {
    const siteId = sanitizeRoutingSegment(selector.siteId);
    const nodeSegment = sanitizeRoutingSegment(selector.nodeId ?? selector.nodeGroup);

    switch (messageType) {
      case 'execution.job': {
        const capabilityKind = sanitizeRoutingSegment(selector.capabilityKind);
        const capabilityName = sanitizeRoutingSegment(selector.capabilityName);
        return `edge.job.${siteId}.${nodeSegment}.${capabilityKind}.${capabilityName}`;
      }
      case 'execution.ack':
        return `edge.event.ack.${siteId}.${nodeSegment}`;
      case 'execution.progress':
        return `edge.event.progress.${siteId}.${nodeSegment}`;
      case 'execution.result':
        return `edge.event.result.${siteId}.${nodeSegment}`;
      case 'execution.failure':
        return `edge.event.failure.${siteId}.${nodeSegment}`;
      default:
        return `edge.unknown.${siteId}.${nodeSegment}`;
    }
  },
};

export function buildRoutingKey(messageType: EdgeMessageType, selector: RoutingKeySelector): string {
  return defaultRoutingKeyStrategy.build(messageType, selector);
}

export function buildJobRoutingKey(target: TargetSelector, capability: { kind: string; name: string }): string {
  return buildRoutingKey('execution.job', {
    siteId: target.siteId,
    nodeId: target.nodeId,
    nodeGroup: target.nodeGroup,
    capabilityKind: capability.kind,
    capabilityName: capability.name,
  });
}

export function resolveConfig(config: EdgeChannelConfig): ResolvedEdgeChannelConfig {
  return {
    ...config,
    jobsExchange: config.jobsExchange ?? defaultExchangeConfig.jobsExchange,
    eventsExchange: config.eventsExchange ?? defaultExchangeConfig.eventsExchange,
    deadLetterExchange: config.deadLetterExchange ?? defaultExchangeConfig.deadLetterExchange,
    prefetchCount: config.prefetchCount ?? 1,
    maxMessageSizeBytes: config.maxMessageSizeBytes ?? 1024 * 1024,
    reconnectEnabled: config.reconnectEnabled ?? true,
    reconnectDelayMs: config.reconnectDelayMs ?? 1000,
    reconnectMaxDelayMs: config.reconnectMaxDelayMs ?? 30_000,
    backpressureTimeoutMs: config.backpressureTimeoutMs ?? 5000,
  };
}

export function buildConsumerQueueName(config: EdgeChannelConfig): string {
  const strategy = config.queueNamingStrategy ?? defaultQueueNamingStrategy;
  return strategy.buildConsumerQueueName({
    siteId: config.siteId,
    nodeId: config.nodeId,
    nodeGroup: config.nodeGroup,
    explicitName: config.consumerQueueName,
  });
}

export function buildJobBindingKeys(config: EdgeChannelConfig): string[] {
  const siteCandidates = [config.siteId, 'any'].filter((value, index, values) => value && values.indexOf(value) === index);
  const workerCandidates = [config.nodeId, config.nodeGroup, 'any'].filter(
    (value, index, values) => value && values.indexOf(value) === index,
  );

  const keys: string[] = [];

  for (const siteId of siteCandidates) {
    for (const worker of workerCandidates) {
      keys.push(`edge.job.${sanitizeRoutingSegment(siteId)}.${sanitizeRoutingSegment(worker)}.*.*`);
    }
  }

  return keys;
}

export function validateConfig(config: EdgeChannelConfig): string[] {
  const errors: string[] = [];

  if (!config.amqpUrl?.trim()) {
    errors.push('amqpUrl is required');
  }

  if (config.prefetchCount !== undefined && (!Number.isInteger(config.prefetchCount) || config.prefetchCount <= 0)) {
    errors.push('prefetchCount must be a positive integer');
  }

  if (
    config.maxMessageSizeBytes !== undefined &&
    (!Number.isInteger(config.maxMessageSizeBytes) || config.maxMessageSizeBytes <= 0)
  ) {
    errors.push('maxMessageSizeBytes must be a positive integer');
  }

  if (config.reconnectDelayMs !== undefined && (!Number.isInteger(config.reconnectDelayMs) || config.reconnectDelayMs <= 0)) {
    errors.push('reconnectDelayMs must be a positive integer');
  }

  if (
    config.reconnectMaxDelayMs !== undefined &&
    (!Number.isInteger(config.reconnectMaxDelayMs) || config.reconnectMaxDelayMs <= 0)
  ) {
    errors.push('reconnectMaxDelayMs must be a positive integer');
  }

  if (
    config.reconnectDelayMs !== undefined &&
    config.reconnectMaxDelayMs !== undefined &&
    config.reconnectDelayMs > config.reconnectMaxDelayMs
  ) {
    errors.push('reconnectDelayMs must be less than or equal to reconnectMaxDelayMs');
  }

  if (
    config.backpressureTimeoutMs !== undefined &&
    (!Number.isInteger(config.backpressureTimeoutMs) || config.backpressureTimeoutMs <= 0)
  ) {
    errors.push('backpressureTimeoutMs must be a positive integer');
  }

  return errors;
}