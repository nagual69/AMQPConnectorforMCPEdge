import type { Channel, ConsumeMessage, Options } from 'amqplib';

import type { EdgeChannelConfig } from '../config/index.js';
import { buildConsumerQueueName, buildJobBindingKeys, resolveConfig, validateConfig } from '../config/index.js';
import { assertCompatibleEnvelope, type ExecutionJobEnvelope } from '../contracts/index.js';
import type { EdgeChannelConnectionManager } from '../connection/connection-manager.js';
import { createHealthSnapshot, type EdgeChannelHealth } from '../health/index.js';

export interface JobDeliveryContext {
  deliveryTag?: number;
  routingKey?: string;
  redelivered?: boolean;
}

export type EdgeJobHandler = (job: ExecutionJobEnvelope, context: JobDeliveryContext) => Promise<void>;

export interface EdgeJobConsumer {
  start(): Promise<void>;
  stop(): Promise<void>;
  onJob(handler: EdgeJobHandler): void;
  ack(delivery: JobDeliveryContext): Promise<void>;
  nack(delivery: JobDeliveryContext, options?: { requeue?: boolean; reason?: string }): Promise<void>;
  health(): Promise<EdgeChannelHealth>;
}

export class EdgeJobConsumer implements EdgeJobConsumer {
  private readonly config;

  private readonly connectionManager;

  private jobHandler: EdgeJobHandler = async () => undefined;

  private readonly pendingDeliveries = new Map<number, ConsumeMessage>();

  private consumerActive = false;

  private consumerTag?: string;

  public constructor(config: EdgeChannelConfig, connectionManager: EdgeChannelConnectionManager) {
    const validationErrors = validateConfig(config);

    if (validationErrors.length > 0) {
      throw new Error(`invalid edge channel config: ${validationErrors.join('; ')}`);
    }

    this.config = resolveConfig(config);
    this.connectionManager = connectionManager;
    connectionManager.onReconnect(async () => {
      if (!this.consumerActive) {
        return;
      }

      await this.initializeConsumer();
    });
  }

  public onJob(handler: EdgeJobHandler): void {
    this.jobHandler = handler;
  }

  public async start(): Promise<void> {
    if (this.consumerActive) {
      return;
    }

    await this.initializeConsumer();
    this.consumerActive = true;
  }

  public async stop(): Promise<void> {
    if (!this.consumerActive) {
      return;
    }

    const channel = await this.connectionManager.getConsumerChannel();

    if (this.consumerTag) {
      await channel.cancel(this.consumerTag).catch(() => undefined);
      this.consumerTag = undefined;
    }

    this.consumerActive = false;
    this.pendingDeliveries.clear();
  }

  public async ack(delivery: JobDeliveryContext): Promise<void> {
    const message = this.getPendingMessage(delivery.deliveryTag);
    const channel = await this.connectionManager.getConsumerChannel();
    channel.ack(message);
    this.pendingDeliveries.delete(message.fields.deliveryTag);
  }

  public async nack(delivery: JobDeliveryContext, options: { requeue?: boolean; reason?: string } = {}): Promise<void> {
    const message = this.getPendingMessage(delivery.deliveryTag);
    const channel = await this.connectionManager.getConsumerChannel();
    channel.nack(message, false, options.requeue ?? false);
    this.pendingDeliveries.delete(message.fields.deliveryTag);
  }

  public async health(): Promise<EdgeChannelHealth> {
    const connectionHealth = await this.connectionManager.health();

    return createHealthSnapshot({
      connected: connectionHealth.connected,
      consumerActive: this.consumerActive,
      publisherActive: connectionHealth.publisherActive,
      details: {
        pendingDeliveries: this.pendingDeliveries.size,
      },
    });
  }

  private async initializeConsumer(): Promise<void> {
    const existingTag = this.consumerTag;

    const channel = await this.connectionManager.getConsumerChannel();
    await channel.assertExchange(this.config.jobsExchange, 'topic', { durable: true });
    await channel.assertExchange(this.config.deadLetterExchange, 'topic', { durable: true });
    await channel.prefetch(this.config.prefetchCount);

    const queueName = buildConsumerQueueName(this.config);
    const queueOptions: Options.AssertQueue = {
      durable: true,
      ...this.config.consumerQueueOptions,
      arguments: {
        ...(this.config.consumerQueueOptions?.arguments ?? {}),
        'x-dead-letter-exchange': this.config.deadLetterExchange,
      },
    };

    await channel.assertQueue(queueName, queueOptions);

    for (const bindingKey of buildJobBindingKeys(this.config)) {
      await channel.bindQueue(queueName, this.config.jobsExchange, bindingKey);
    }

    const consumeResult = await channel.consume(
      queueName,
      (message) => {
        void this.handleMessage(channel, message);
      },
      {
        consumerTag: this.config.consumerTag,
      },
    );

    if (existingTag) {
      await channel.cancel(existingTag).catch(() => undefined);
    }

    this.consumerTag = consumeResult.consumerTag;
  }

  private async handleMessage(channel: Channel, message: ConsumeMessage | null): Promise<void> {
    if (!message) {
      return;
    }

    if (message.content.byteLength > this.config.maxMessageSizeBytes) {
      channel.nack(message, false, false);
      return;
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(message.content.toString('utf8'));
    } catch {
      channel.nack(message, false, false);
      return;
    }

    let envelope: ExecutionJobEnvelope;

    try {
      const validatedEnvelope = assertCompatibleEnvelope(parsedPayload, {
        role: 'consumer',
        consumerVersion: this.config.runtimeConsumerVersion,
        allowMissingRuntimeVersion: false,
      });

      if (validatedEnvelope.messageType !== 'execution.job') {
        throw new Error(`unexpected messageType ${validatedEnvelope.messageType}`);
      }

      envelope = validatedEnvelope;
    } catch {
      channel.nack(message, false, false);
      return;
    }

    const context: JobDeliveryContext = {
      deliveryTag: message.fields.deliveryTag,
      routingKey: message.fields.routingKey,
      redelivered: message.fields.redelivered,
    };

    this.pendingDeliveries.set(message.fields.deliveryTag, message);

    try {
      await this.jobHandler(envelope, context);
    } catch (error) {
      if (this.pendingDeliveries.has(message.fields.deliveryTag)) {
        await this.nack(context, {
          requeue: true,
          reason: error instanceof Error ? error.message : 'job handler failed',
        });
      }
    }
  }

  private getPendingMessage(deliveryTag?: number): ConsumeMessage {
    if (deliveryTag === undefined) {
      throw new Error('deliveryTag is required');
    }

    const message = this.pendingDeliveries.get(deliveryTag);

    if (!message) {
      throw new Error(`delivery ${deliveryTag} is not pending`);
    }

    return message;
  }
}