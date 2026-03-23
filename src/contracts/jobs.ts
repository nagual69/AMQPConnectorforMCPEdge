import { z } from 'zod';

import type { ExecutionAttemptMetadata } from './compatibility.js';
import type { BaseEdgeEnvelope } from './envelopes.js';
import { createEnvelopeSchema } from './envelopes.js';

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

export const targetSelectorSchema = z
  .object({
    siteId: z.string().min(1).optional(),
    nodeId: z.string().min(1).optional(),
    nodeGroup: z.string().min(1).optional(),
    capabilityTags: z.array(z.string().min(1)).optional(),
  })
  .passthrough();

export const executionAttemptMetadataSchema = z
  .object({
    attemptNumber: z.number().int().positive().optional(),
    maxAttempts: z.number().int().positive().optional(),
    firstAttemptAt: z.string().datetime({ offset: true }).optional(),
    previousAttemptAt: z.string().datetime({ offset: true }).optional(),
  })
  .passthrough();

export const executionJobPayloadSchema = z
  .object({
    jobId: z.string().min(1),
    attemptId: z.string().min(1),
    idempotencyKey: z.string().min(1),
    attempt: executionAttemptMetadataSchema.optional(),
    target: targetSelectorSchema,
    timeoutMs: z.number().int().positive(),
    createdBy: z
      .object({
        controlPlane: z.string().min(1),
        actorId: z.string().min(1).optional(),
      })
      .passthrough(),
    capability: z
      .object({
        kind: z.enum(['tool', 'resource', 'prompt', 'task']),
        name: z.string().min(1),
        version: z.string().min(1).optional(),
      })
      .passthrough(),
    input: z.record(z.string(), z.unknown()),
    packageAssignment: z
      .object({
        packageId: z.string().min(1),
        packageVersion: z.string().min(1),
        releaseId: z.string().min(1).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const executionJobEnvelopeSchema = createEnvelopeSchema('execution.job', executionJobPayloadSchema);