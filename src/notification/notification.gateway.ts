import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Notification } from '../common/types/notification.interface';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private userSockets = new Map<string, string>();

  handleConnection(client: Socket): void {
    const adminId = client.handshake.query.adminId as string;
    if (adminId) {
      this.userSockets.set(adminId, client.id);
    }
  }

  handleDisconnect(client: Socket): void {
    for (const [adminId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(adminId);
        break;
      }
    }
  }

  sendNotificationTo(adminId: string, payload: Notification): void {
    const socketId = this.userSockets.get(adminId);
    if (socketId) {
      this.server.to(socketId).emit('notification', payload);
    }
  }

  broadcastToAdmins(adminIds: string[], payload: Notification): void {
    for (const adminId of adminIds) {
      this.sendNotificationTo(adminId, payload);
    }
  }
}
