import type { Human } from '@vladmandic/human';

const MATCH_OPTIONS = { order: 2, multiplier: 25, min: 0.2, max: 0.8 } as const;
const CONFIDENCE_THRESHOLD = 0.8;

export type ValidateFaceResult =
  | { humanFace: true; embedding: number[] }
  | { humanFace: false };

/**
 * Run face detection on input tensor; return whether a face was found and its embedding.
 */
export async function validateFace(
  human: InstanceType<typeof Human>,
  input: Parameters<InstanceType<typeof Human>['detect']>[0]
): Promise<ValidateFaceResult> {
  const result = await human.detect(input);
  const face = result?.face?.[0];
  if (!face?.embedding?.length) {
    return { humanFace: false };
  }
  return { humanFace: true, embedding: face.embedding };
}

/**
 * Compare two face descriptors; returns similarity in 0..1.
 * Use CONFIDENCE_THRESHOLD (0.8) for match decision.
 */
export function compareFaces(
  human: InstanceType<typeof Human>,
  descriptor1: number[],
  descriptor2: number[]
): number {
  return human.match.similarity(descriptor1, descriptor2, MATCH_OPTIONS);
}

export function isMatch(similarity: number): boolean {
  return similarity >= CONFIDENCE_THRESHOLD;
}

export { CONFIDENCE_THRESHOLD };
