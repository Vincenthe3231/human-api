/**
 * Concise debug logger for API endpoints and Next.js integration.
 * Use requestId for correlation between human-api and Next.js project.
 */

const PREFIX = '[recognize]';

export function createDebugLogger(requestId: string) {
  return {
    request: (userId: string) =>
      console.log(`${PREFIX} userId=%s requestId=%s`, userId, requestId),
    fetchDescriptor: (status: string, detail?: string) =>
      console.log(
        `${PREFIX} fetch descriptor status=%s${detail ? ` (${detail})` : ''}`,
        status
      ),
    detection: (humanFace: boolean, faceCount?: number) =>
      console.log(
        `${PREFIX} humanFace=%s faces=%s`,
        String(humanFace),
        faceCount ?? 0
      ),
    match: (similarity: number, match: boolean) =>
      console.log(`${PREFIX} similarity=%s match=%s`, similarity.toFixed(2), String(match)),
    response: (status: string, durationMs: number) =>
      console.log(`${PREFIX} status=%s duration=%dms`, status, durationMs),
    error: (message: string, err?: unknown) =>
      console.error(`${PREFIX} error=%s`, message, err ?? ''),
  };
}

export function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
