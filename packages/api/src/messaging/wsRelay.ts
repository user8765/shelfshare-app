import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { redisSub, redis } from '../db/redis.js';

let wsClient: ApiGatewayManagementApiClient | null = null;

export function initWsRelay(endpoint: string) {
  wsClient = new ApiGatewayManagementApiClient({ endpoint });

  redisSub.psubscribe('user:*:messages', (err) => {
    if (err) console.error('Redis psubscribe error', err);
  });

  redisSub.on('pmessage', async (_pattern, channel, messageJson) => {
    // channel = "user:<recipientId>:messages"
    const recipientId = channel.split(':')[1];
    if (!recipientId || !wsClient) return;

    const connectionId = await redis.get(`ws:${recipientId}`);
    if (!connectionId) return; // user not connected

    try {
      await wsClient.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(messageJson),
      }));
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === 'GoneException') {
        await redis.del(`ws:${recipientId}`);
      }
    }
  });
}
