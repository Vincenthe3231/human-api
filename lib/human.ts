import Human from '@vladmandic/human';

const config: Partial<ConstructorParameters<typeof Human>[0]> = {
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

export type { Human };
