import { QdrantClient } from '@qdrant/js-client-rest';
import { getLogger } from './logger.js';
import { getConfig } from './config.js';

const log = getLogger();
let client: QdrantClient | null;

const COLLECTION_NAME = 'aiworkmemory';
const VECTOR_DIMENSIONS = 768;

export async function getQdrantClient(): Promise<QdrantClient> {
  if (client) return client;

  const config = getConfig().get();
  client = new QdrantClient({
    url: config.qdrant.url,
    apiKey: config.qdrant.apiKey,
  });

  log.info('Qdrant client connected');
  return client;
}

export async function ensureQdrantCollection(): Promise<void> {
  const qdrant = await getQdrantClient();

  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === COLLECTION_NAME
    );

    if (!exists) {
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_DIMENSIONS,
          distance: 'Cosine',
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      });

      // Create payload index for filtering
      await qdrant.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'source_type',
        field_schema: 'keyword',
      });

      await qdrant.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'app_name',
        field_schema: 'keyword',
      });

      await qdrant.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'project_name',
        field_schema: 'keyword',
      });

      await qdrant.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'timestamp',
        field_schema: 'keyword',
      });

      log.info({ collection: COLLECTION_NAME }, 'Qdrant collection created');
    } else {
      log.info({ collection: COLLECTION_NAME }, 'Qdrant collection exists');
    }
  } catch (err) {
    log.error({ err }, 'Failed to ensure Qdrant collection');
    throw err;
  }
}

export async function upsertVector(params: {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}): Promise<void> {
  const qdrant = await getQdrantClient();
  await qdrant.upsert(COLLECTION_NAME, {
    points: [
      {
        id: params.id,
        vector: params.vector,
        payload: params.payload,
      },
    ],
  });
}

export async function upsertVectorsBatch(
  points: Array<{
    id: string;
    vector: number[];
    payload: Record<string, unknown>;
  }>
): Promise<void> {
  const qdrant = await getQdrantClient();
  await qdrant.upsert(COLLECTION_NAME, { points });
}

export async function searchVectors(params: {
  vector: number[];
  limit?: number;
  scoreThreshold?: number;
  filter?: Record<string, unknown>;
}): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
  const qdrant = await getQdrantClient();

  const results = await qdrant.search(COLLECTION_NAME, {
    vector: params.vector,
    limit: params.limit ?? 10,
    score_threshold: params.scoreThreshold ?? 0.5,
    filter: params.filter as any,
  });

  return results.map((r) => ({
    id: r.id as string,
    score: r.score,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }));
}

export async function getCollectionInfo(): Promise<{
  pointsCount: number;
  segmentsCount: number;
}> {
  const qdrant = await getQdrantClient();
  const info = await qdrant.getCollection(COLLECTION_NAME);
  return {
    pointsCount: info.points_count ?? 0,
    segmentsCount: info.segments_count ?? 0,
  };
}

export async function deleteVector(id: string): Promise<void> {
  const qdrant = await getQdrantClient();
  await qdrant.delete(COLLECTION_NAME, { points: [id] });
}

export async function deleteVectorsByFilter(filter: Record<string, unknown>): Promise<void> {
  const qdrant = await getQdrantClient();
  await qdrant.delete(COLLECTION_NAME, { filter: filter as any });
}
