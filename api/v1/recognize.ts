/**
 * POST /api/v1/recognize
 * Validates captured face against registered face descriptor from Supabase.
 * Returns humanFace, match, confidence (only when >= 0.8), and debug info.
 * Uses Sharp + @tensorflow/tfjs (CPU) for Node 24 compatibility (no tfjs-node).
 */
import * as tf from '@tensorflow/tfjs';
import { getHuman } from '../../lib/human';
import { getStoredFacePhotoUrls } from '../../lib/supabase';
import { decodeImageToTensor } from '../../lib/decodeImage';
import { validateFace, compareFaces, isMatch, CONFIDENCE_THRESHOLD } from '../../lib/validate';
import { createDebugLogger, generateRequestId } from '../../lib/debug';

let backendReady = false;
async function ensureTfBackend(): Promise<void> {
  if (backendReady) return;
  await tf.setBackend('cpu');
  await tf.ready();
  backendReady = true;
}

async function fetchImageAsUint8Array(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

type RecognizeBody = {
  userId?: string;
  image?: string; // base64 encoded image (with or without data URL prefix)
};

function parseBase64ToUint8Array(data: string): Uint8Array {
  const base64 = data.replace(/^data:image\/\w+;base64,/, '');
  // Node: Buffer; browser: atob. tf.node.decodeImage accepts Uint8Array.
  if (typeof (globalThis as unknown as { Buffer?: { from(s: string, enc: string): Uint8Array } }).Buffer !== 'undefined') {
    return (globalThis as unknown as { Buffer: { from(s: string, enc: string): Uint8Array } }).Buffer.from(base64, 'base64');
  }
  const binary = (globalThis as unknown as { atob(s: string): string }).atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface Req { method?: string; body?: RecognizeBody }
interface Res {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => Res;
  json: (body: unknown) => void;
}

export default async function handler(req: Req, res: Res) {
  const requestId = generateRequestId();
  const debug = createDebugLogger(requestId);
  const start = Date.now();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
      humanFace: false,
      match: false,
      debug: {
        status: 'error',
        message: 'Method not allowed',
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  try {
    const body = (req.body ?? {}) as RecognizeBody;
    const { userId, image: imageBase64 } = body;

    if (!userId || typeof userId !== 'string') {
      debug.error('missing or invalid userId');
      res.status(400).json({
        humanFace: false,
        match: false,
        debug: {
          status: 'error',
          message: 'userId is required',
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      debug.error('missing or invalid image');
      res.status(400).json({
        humanFace: false,
        match: false,
        debug: {
          status: 'error',
          message: 'image (base64) is required',
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    debug.request(userId);

    let referenceDescriptors: number[][] = [];
    try {
      const photoUrls = await getStoredFacePhotoUrls(userId);
      if (photoUrls.length > 0) {
        debug.fetchDescriptor('url');
        await ensureTfBackend();
        const human = await getHuman();
        const descriptorResults = await Promise.all(
          photoUrls.map(async (url) => {
            const imageBytes = await fetchImageAsUint8Array(url);
            const refTensor = await decodeImageToTensor(imageBytes);
            try {
              const refResult = await validateFace(human, refTensor);
              return refResult.humanFace ? refResult.embedding : null;
            } finally {
              refTensor.dispose();
            }
          })
        );
        referenceDescriptors = descriptorResults.filter((d): d is number[] => d !== null);
      }
      debug.fetchDescriptor(referenceDescriptors.length > 0 ? 'ok' : 'not_found');
    } catch (e: unknown) {
      debug.fetchDescriptor('error');
      debug.error('Fetch reference descriptors failed', e);
      res.status(502).json({
        humanFace: false,
        match: false,
        debug: {
          status: 'error',
          message: 'Failed to fetch registered face',
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (referenceDescriptors.length === 0) {
      res.status(404).json({
        humanFace: false,
        match: false,
        debug: {
          status: 'error',
          message: 'No registered face for user',
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    await ensureTfBackend();
    const imageBytes = parseBase64ToUint8Array(imageBase64);
    const human = await getHuman();
    const tensor = await decodeImageToTensor(imageBytes);

    let validateResult: Awaited<ReturnType<typeof validateFace>>;
    try {
      validateResult = await validateFace(human, tensor);
    } finally {
      tensor.dispose();
    }

    debug.detection(validateResult.humanFace, validateResult.humanFace ? 1 : 0);

    if (!validateResult.humanFace) {
      debug.response('no_face', Date.now() - start);
      res.status(200).json({
        humanFace: false,
        match: false,
        debug: {
          status: 'no_face',
          message: 'No face detected in image',
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    let bestSimilarity = 0;
    for (const refDescriptor of referenceDescriptors) {
      const similarity = compareFaces(human, refDescriptor, validateResult.embedding);
      if (similarity > bestSimilarity) bestSimilarity = similarity;
    }
    const match = isMatch(bestSimilarity);
    debug.match(bestSimilarity, match);

    const payload: {
      humanFace: boolean;
      match: boolean;
      confidence?: number;
      debug: { status: string; message: string; requestId: string; timestamp: string };
    } = {
      humanFace: true,
      match,
      debug: {
        status: match ? 'success' : 'no_match',
        message: match ? 'Face detected and matched' : 'Face detected but did not match',
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    if (bestSimilarity >= CONFIDENCE_THRESHOLD) {
      payload.confidence = Math.round(bestSimilarity * 100) / 100;
    }

    debug.response(payload.debug.status, Date.now() - start);
    res.status(200).json(payload);
  } catch (err) {
    debug.error('handler error', err);
    debug.response('error', Date.now() - start);
    res.status(500).json({
      humanFace: false,
      match: false,
      debug: {
        status: 'error',
        message: err instanceof Error ? err.message : 'Internal server error',
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
