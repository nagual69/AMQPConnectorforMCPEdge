import { ZodError } from 'zod';

import type { CompatibilityMetadata, CompatibilityValidationOptions, CompatibilityValidationResult, ExecutionAttemptMetadata } from './compatibility.js';
import type { BaseEdgeEnvelope, EdgeMessageType, MessageEnvelopeVersion } from './envelopes.js';
import {
  edgeMessageTypes,
} from './envelopes.js';
import type { JobAckMessage, JobAckPayload, JobFailureEvent, JobFailurePayload, JobProgressEvent, JobProgressPayload, JobResultEvent, JobResultPayload } from './events.js';
import {
  jobAckEnvelopeSchema,
  jobFailureEnvelopeSchema,
  jobProgressEnvelopeSchema,
  jobResultEnvelopeSchema,
} from './events.js';
import type { ExecutionJobEnvelope, ExecutionJobPayload, TargetSelector } from './jobs.js';
import { executionJobEnvelopeSchema } from './jobs.js';
import { validateCompatibility } from './compatibility.js';

export type {
  CompatibilityMetadata,
  CompatibilityValidationOptions,
  CompatibilityValidationResult,
  ExecutionAttemptMetadata,
} from './compatibility.js';
export { validateCompatibility } from './compatibility.js';
export type { BaseEdgeEnvelope, EdgeMessageType, MessageEnvelopeVersion } from './envelopes.js';
export { edgeMessageTypes } from './envelopes.js';
export type { TargetSelector, ExecutionJobPayload, ExecutionJobEnvelope } from './jobs.js';
export type {
  JobAckPayload,
  JobProgressPayload,
  JobResultPayload,
  JobFailurePayload,
  JobAckMessage,
  JobProgressEvent,
  JobResultEvent,
  JobFailureEvent,
} from './events.js';

export type EdgeEnvelope =
  | ExecutionJobEnvelope
  | JobAckMessage
  | JobProgressEvent
  | JobResultEvent
  | JobFailureEvent;

const envelopeSchemaMap = {
  'execution.job': executionJobEnvelopeSchema,
  'execution.ack': jobAckEnvelopeSchema,
  'execution.progress': jobProgressEnvelopeSchema,
  'execution.result': jobResultEnvelopeSchema,
  'execution.failure': jobFailureEnvelopeSchema,
} as const;

export function isEdgeMessageType(value: unknown): value is EdgeMessageType {
  return typeof value === 'string' && edgeMessageTypes.includes(value as EdgeMessageType);
}

export function validateEnvelope(payload: unknown): EdgeEnvelope {
  if (typeof payload !== 'object' || payload === null || !('messageType' in payload)) {
    throw new Error('payload is not a valid edge envelope');
  }

  const messageType = (payload as { messageType?: unknown }).messageType;

  if (!isEdgeMessageType(messageType)) {
    throw new Error(`unsupported messageType: ${String(messageType)}`);
  }

  try {
    return envelopeSchemaMap[messageType].parse(payload) as EdgeEnvelope;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`invalid ${messageType} envelope: ${error.message}`);
    }

    throw error;
  }
}

export function assertCompatibleEnvelope(
  payload: unknown,
  options: CompatibilityValidationOptions = {},
): EdgeEnvelope {
  const envelope = validateEnvelope(payload);
  const result = validateCompatibility(envelope.compatibility, options);

  if (!result.compatible) {
    throw new Error(result.reasons.join('; '));
  }

  return envelope;
}