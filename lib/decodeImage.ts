/**
 * Decode image bytes to a tensor using Sharp (no tfjs-node).
 * Use with @tensorflow/tfjs CPU backend for Node 24 compatibility.
 * Output format matches Human Node demo: shape [1, height, width, 3], float32 0-255.
 */
import sharp from 'sharp';
import * as tf from '@tensorflow/tfjs';

const CHANNELS = 3; // RGB

/**
 * Decode image buffer (JPEG/PNG/etc.) to a tf.Tensor [1, height, width, 3].
 * Values are float32 in 0-255 range (same as tf.node.decodeImage + cast in Human demo).
 * Caller must dispose the tensor when done.
 */
export async function decodeImageToTensor(
  imageBytes: Uint8Array | Buffer
): Promise<tf.Tensor> {
  const { data, info } = await sharp(imageBytes)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { height, width, channels } = info;
  const c = channels >= CHANNELS ? CHANNELS : channels;
  const shape3: [number, number, number] = [height, width, c];

  const uint8 = new Uint8Array(data);
  const decoded = tf.tensor3d(uint8, shape3, 'int32');
  const expanded = tf.expandDims(decoded, 0);
  decoded.dispose();
  const tensor = tf.cast(expanded, 'float32');
  expanded.dispose();
  return tensor;
}
