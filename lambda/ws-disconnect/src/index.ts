import { createClient } from 'redis';
import type { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';

const redisClient = createClient({ url: process.env['REDIS_URL'] });
await redisClient.connect();

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  // Scan for the key matching this connectionId and delete it
  let cursor = 0;
  do {
    const result = await redisClient.scan(cursor, { MATCH: 'ws:*', COUNT: 100 });
    cursor = result.cursor;
    for (const key of result.keys) {
      const val = await redisClient.get(key);
      if (val === connectionId) {
        await redisClient.del(key);
        return { statusCode: 200 };
      }
    }
  } while (cursor !== 0);
  return { statusCode: 200 };
};
