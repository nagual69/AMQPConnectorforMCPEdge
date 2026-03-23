import type { EdgeChannelConfig } from '../config/index.js';
import { EdgeJobConsumer } from '../consumer/index.js';
import { EdgeEventPublisher } from '../publisher/index.js';

import { EdgeChannelConnectionManager } from './connection-manager.js';

type EdgeJobConsumerSurface = Pick<
  EdgeJobConsumer,
  'start' | 'stop' | 'onJob' | 'ack' | 'nack' | 'health'
>;

type EdgeEventPublisherSurface = Pick<
  EdgeEventPublisher,
  'publishAck' | 'publishProgress' | 'publishResult' | 'publishFailure' | 'health'
>;

export interface EdgeChannel {
  consumer: EdgeJobConsumerSurface;
  publisher: EdgeEventPublisherSurface;
  close(): Promise<void>;
}

export async function createEdgeChannel(config: EdgeChannelConfig): Promise<EdgeChannel> {
  const connectionManager = new EdgeChannelConnectionManager(config);
  await connectionManager.connect();

  const consumer = new EdgeJobConsumer(config, connectionManager);
  const publisher = new EdgeEventPublisher(config, connectionManager);

  return {
    consumer,
    publisher,
    async close(): Promise<void> {
      await consumer.stop().catch(() => undefined);
      await connectionManager.close();
    },
  };
}

export { EdgeChannelConnectionManager } from './connection-manager.js';