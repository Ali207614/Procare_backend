import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, string>();

  handleConnection(client: Socket) {
    const adminId = client.handshake.query.adminId as string;
    if (adminId) {
      this.userSockets.set(adminId, client.id);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [adminId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(adminId);
        break;
      }
    }
  }

  sendNotificationTo(adminId: string, payload: any) {
    const socketId = this.userSockets.get(adminId);
    if (socketId) {
      this.server.to(socketId).emit('notification', payload);
    }
  }

  broadcastToAdmins(adminIds: string[], payload: any) {
    for (const adminId of adminIds) {
      this.sendNotificationTo(adminId, payload);
    }
  }
}
