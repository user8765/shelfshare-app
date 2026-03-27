import { createClient } from 'redis';
import type { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import jwt from 'jsonwebtoken';

const redisClient = createClient({ url: process.env['REDIS_URL'] });
await redisClient.connect();

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const token = event.queryStringParameters?.['token'];
  if (!token) return { statusCode: 401 };

  try {
    const secret = process.env['JWT_SECRET'];
    if (!secret) return { statusCode: 500 };
    const payload = jwt.verify(token, secret) as { sub: string };
    await redisClient.set(`ws:${payload.sub}`, event.requestContext.connectionId, { EX: 86400 });
    return { statusCode: 200 };
  } catch {
    return { statusCode: 401 };
  }
};
