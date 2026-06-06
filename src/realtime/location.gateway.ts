// Port of Zonic.Api/Hubs/LocationHub.cs (SignalR Hub → Nest WebSocket Gateway).
// Namespace: /hubs/location
//   in : StartRun, StopRun, SendLocation     out: Connected, RunStarted, RunStopped, ZoneUpdated
//
// SendLocation keeps the SignalR positional-argument contract
// (lat, lng, accuracy, speed, timestamp, runTypeId), so it is wired via a raw socket
// listener; StartRun/StopRun map cleanly to @SubscribeMessage.
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { encode } from '../common/helpers/geohash';
import { parseExactDateTime } from '../common/helpers/datetime';
import { RunSessionService } from '../run-sessions/run-session.service';
import { LocationChannel } from './location.channel';

@WebSocketGateway({ namespace: '/hubs/location', cors: { origin: '*' } })
export class LocationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Namespace;

  // Mirror the static ConcurrentDictionary fields (gateway is a singleton).
  private readonly lastUpdate = new Map<string, number>();
  private readonly connectionGroups = new Map<string, string>();

  constructor(
    private readonly channel: LocationChannel,
    private readonly runSessionService: RunSessionService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket): void {
    // [Authorize] is commented out in the original hub — unauthenticated sockets may
    // still connect; user-scoped actions are no-ops without a user id.
    client.data.userId = this.authenticate(client);
    console.log(`CONNECTED: ${client.id}`);
    client.emit('Connected', client.id);

    // SendLocation — positional args (SignalR contract) → raw listener.
    client.on(
      'SendLocation',
      (
        lat: number,
        lng: number,
        accuracy: number,
        speed: number,
        timestamp: string,
        runTypeId: number,
      ) => this.sendLocation(client, lat, lng, accuracy, speed, timestamp, runTypeId),
    );
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const group = this.connectionGroups.get(client.id);
    if (group !== undefined) {
      this.connectionGroups.delete(client.id);
      client.leave(group);
    }

    const userId = this.getUserId(client);
    if (userId != null) {
      this.lastUpdate.delete(userId);
      await this.runSessionService.stopRun(userId);
    }
  }

  @SubscribeMessage('StartRun')
  async startRun(
    @ConnectedSocket() client: Socket,
    @MessageBody() runTypeId: number,
  ): Promise<void> {
    const userId = this.getUserId(client);
    if (userId == null) return;

    const sessionId = await this.runSessionService.startRun(userId, runTypeId);
    client.emit('RunStarted', sessionId);
  }

  @SubscribeMessage('StopRun')
  async stopRun(@ConnectedSocket() client: Socket): Promise<void> {
    const userId = this.getUserId(client);
    if (userId == null) return;

    await this.runSessionService.stopRun(userId);
    client.emit('RunStopped');
  }

  private async sendLocation(
    client: Socket,
    lat: number,
    lng: number,
    accuracy: number,
    speed: number,
    timestamp: string,
    runTypeId: number,
  ): Promise<void> {
    console.log(
      `SEND LOCATION CALLED: lat=${lat}, lng=${lng}, acc=${accuracy}, spd=${speed}, ts=${timestamp}`,
    );
    const userId = this.getUserId(client);
    if (userId == null) return;

    const game = this.config.get('game') as {
      rateLimitSeconds: number;
      minAccuracyMeters: number;
      groupPrecision: number;
    };

    // Rate limit
    const now = Date.now();
    const last = this.lastUpdate.get(userId);
    if (last !== undefined && (now - last) / 1000 < game.rateLimitSeconds) return;
    this.lastUpdate.set(userId, now);

    // Coordinate validation
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

    // Accuracy filter
    if (accuracy > game.minAccuracyMeters) return;

    // Geo group membership
    const geohash = encode(lat, lng, game.groupPrecision);
    const groupKey = `geo:${geohash}`;

    const currentGroup = this.connectionGroups.get(client.id);
    if (currentGroup !== undefined) {
      if (currentGroup !== groupKey) {
        client.leave(currentGroup);
        client.join(groupKey);
        this.connectionGroups.set(client.id, groupKey);
      }
    } else {
      client.join(groupKey);
      this.connectionGroups.set(client.id, groupKey);
    }

    // Parse "dd.MM.yyyy HH:mm:ss"
    const parsedTime = parseExactDateTime(timestamp);
    if (parsedTime === null) return;

    this.channel.write({
      userId,
      latitude: lat,
      longitude: lng,
      accuracy,
      speed,
      timestamp: parsedTime,
      runTypeId,
    });
  }

  /** Broadcast helper used by LocationBackgroundService. */
  broadcastZoneUpdated(groupKey: string, zones: Array<{ geohash: string; userId: string }>): void {
    this.server.to(groupKey).emit('ZoneUpdated', zones);
  }

  private getUserId(client: Socket): string | null {
    return (client.data.userId as string | null) ?? null;
  }

  private authenticate(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, string | undefined>;
    const queryParams = client.handshake.query as Record<string, string | string[] | undefined>;
    const token =
      auth?.access_token ||
      auth?.token ||
      (queryParams?.access_token as string | undefined);
    if (!token) return null;
    try {
      const payload = this.jwt.verify<{ sub: string }>(token, {
        secret: this.config.get<string>('jwt.secretKey'),
        issuer: this.config.get<string>('jwt.issuer'),
        audience: this.config.get<string>('jwt.audience'),
        algorithms: ['HS256'],
      });
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }
}
