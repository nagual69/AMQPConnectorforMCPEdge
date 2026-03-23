import { z } from 'zod';

import type { BaseEdgeEnvelope } from './envelopes.js';
import { createEnvelopeSchema } from './envelopes.js';

export interface JobAckPayload {
  jobId: string;
  attemptId: string;
  siteId?: string;
  nodeId: string;
  accepted: boolean;
  reason?: string;
}

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

export type JobAckMessage = BaseEdgeEnvelope<'execution.ack', JobAckPayload>;
export type JobProgressEvent = BaseEdgeEnvelope<'execution.progress', JobProgressPayload>;
export type JobResultEvent = BaseEdgeEnvelope<'execution.result', JobResultPayload>;
export type JobFailureEvent = BaseEdgeEnvelope<'execution.failure', JobFailurePayload>;

export const jobAckPayloadSchema = z
  .object({
    jobId: z.string().min(1),
    attemptId: z.string().min(1),
    siteId: z.string().min(1).optional(),
    nodeId: z.string().min(1),
    accepted: z.boolean(),
    reason: z.string().min(1).optional(),
  })
  .passthrough();

export const jobProgressPayloadSchema = z
  .object({
    jobId: z.string().min(1),
    attemptId: z.string().min(1),
    siteId: z.string().min(1).optional(),
    nodeId: z.string().min(1),
    state: z.enum(['received', 'started', 'running', 'waiting', 'finishing']),
    percent: z.number().min(0).max(100).optional(),
    message: z.string().min(1).optional(),
    metrics: z.record(z.string(), z.number()).optional(),
  })
  .passthrough();

export const jobResultPayloadSchema = z
  .object({
    jobId: z.string().min(1),
    attemptId: z.string().min(1),
    siteId: z.string().min(1).optional(),
    nodeId: z.string().min(1),
    completedAt: z.string().datetime({ offset: true }),
    output: z.record(z.string(), z.unknown()),
    artifacts: z
      .array(
        z
          .object({
            name: z.string().min(1),
            contentType: z.string().min(1),
            uri: z.string().min(1).optional(),
            inlineData: z.string().min(1).optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const jobFailurePayloadSchema = z
  .object({
    jobId: z.string().min(1),
    attemptId: z.string().min(1),
    siteId: z.string().min(1).optional(),
    nodeId: z.string().min(1),
    failedAt: z.string().datetime({ offset: true }),
    retryable: z.boolean(),
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const jobAckEnvelopeSchema = createEnvelopeSchema('execution.ack', jobAckPayloadSchema);
export const jobProgressEnvelopeSchema = createEnvelopeSchema('execution.progress', jobProgressPayloadSchema);
export const jobResultEnvelopeSchema = createEnvelopeSchema('execution.result', jobResultPayloadSchema);
export const jobFailureEnvelopeSchema = createEnvelopeSchema('execution.failure', jobFailurePayloadSchema);