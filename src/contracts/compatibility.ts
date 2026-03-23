export interface CompatibilityMetadata {
  channelVersion: string;
  minConsumerVersion?: string;
  minProducerVersion?: string;
  serverFamily?: string;
  serverVersion?: string;
  packageVersion?: string;
}

export interface ExecutionAttemptMetadata {
  attemptNumber?: number;
  maxAttempts?: number;
  firstAttemptAt?: string;
  previousAttemptAt?: string;
}

export interface CompatibilityValidationOptions {
  role?: 'consumer' | 'producer' | 'both';
  consumerVersion?: string;
  producerVersion?: string;
  allowMissingRuntimeVersion?: boolean;
}

export interface CompatibilityValidationResult {
  compatible: boolean;
  reasons: string[];
}

function normalizeVersion(version: string): number[] {
  return version
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function compareVersions(left: string, right: string): number {
  const leftParts = normalizeVersion(left);
  const rightParts = normalizeVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

export function validateCompatibility(
  metadata: CompatibilityMetadata,
  options: CompatibilityValidationOptions = {},
): CompatibilityValidationResult {
  const reasons: string[] = [];
  const role = options.role ?? 'both';
  const checkConsumer = role === 'consumer' || role === 'both';
  const checkProducer = role === 'producer' || role === 'both';
  const allowMissingRuntimeVersion = options.allowMissingRuntimeVersion ?? false;

  if (checkConsumer && metadata.minConsumerVersion) {
    if (!options.consumerVersion) {
      if (!allowMissingRuntimeVersion) {
        reasons.push('consumerVersion is required when compatibility.minConsumerVersion is set');
      }
    } else if (compareVersions(options.consumerVersion, metadata.minConsumerVersion) < 0) {
      reasons.push(`consumer version ${options.consumerVersion} is lower than required ${metadata.minConsumerVersion}`);
    }
  }

  if (checkProducer && metadata.minProducerVersion) {
    if (!options.producerVersion) {
      if (!allowMissingRuntimeVersion) {
        reasons.push('producerVersion is required when compatibility.minProducerVersion is set');
      }
    } else if (compareVersions(options.producerVersion, metadata.minProducerVersion) < 0) {
      reasons.push(`producer version ${options.producerVersion} is lower than required ${metadata.minProducerVersion}`);
    }
  }

  return {
    compatible: reasons.length === 0,
    reasons,
  };
}