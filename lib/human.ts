// Node-WASM build (no tfjs-node) for Vercel 250 MB limit.
// Static import so Vercel Node File Trace includes this module in the serverless bundle.
import type HumanConstructor from '@vladmandic/human';
import HumanWasm from '@vladmandic/human/dist/human.node-wasm.js';

const Human = ((HumanWasm as { default?: unknown }).default ?? HumanWasm) as unknown as typeof HumanConstructor;

const config: Partial<ConstructorParameters<typeof Human>[0]> = {
  backend: 'cpu', // Force CPU to avoid WASM backend ENOENT in Node (tfjs-backend-wasm expects local .wasm files)
  modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/',
  debug: false,
  face: {
    enabled: true,
    detector: { enabled: true, rotation: true },
    mesh: { enabled: true },
    description: { enabled: true },
    iris: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  segmentation: { enabled: false },
};

let humanInstance: InstanceType<typeof Human> | null = null;

export async function getHuman(): Promise<InstanceType<typeof Human>> {
  if (humanInstance) return humanInstance;
  humanInstance = new Human(config);
  await humanInstance.load();
  return humanInstance;
}

export type { Human } from '@vladmandic/human';
