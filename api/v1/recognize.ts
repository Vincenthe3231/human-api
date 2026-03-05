/**
 * POST /api/v1/recognize
 * Validates captured face against registered face descriptor from Supabase.
 * Returns humanFace, match, confidence (only when >= 0.8), and debug info.
 */
import * as tf from '@tensorflow/tfjs-node';
import { getHuman } from '../../lib/human';
import { getStoredDescriptor } from '../../lib/supabase';
import { validateFace, compareFaces, isMatch, CONFIDENCE_THRESHOLD } from '../../lib/validate';
import { createDebugLogger, generateRequestId } from '../../lib/debug';

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

    let storedDescriptor: number[] | null = null;
    try {
      storedDescriptor = await getStoredDescriptor(userId);
      debug.fetchDescriptor(storedDescriptor ? 'ok' : 'not_found');
    } catch (e) {
      debug.fetchDescriptor('error');
      debug.error('getStoredDescriptor failed', e);
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

    if (!storedDescriptor || storedDescriptor.length === 0) {
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

    const imageBytes = parseBase64ToUint8Array(imageBase64);
    const human = await getHuman();
    const tensor = tf.node.decodeImage(imageBytes, 3) as tf.Tensor3D;

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

    const similarity = compareFaces(human, storedDescriptor, validateResult.embedding);
    const match = isMatch(similarity);
    debug.match(similarity, match);

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

    if (similarity >= CONFIDENCE_THRESHOLD) {
      payload.confidence = Math.round(similarity * 100) / 100;
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
