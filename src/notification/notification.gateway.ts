import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BroadcastMessage } from '../common/types/notification.interface';
import { Inject, forwardRef } from '@nestjs/common';
import { AdminsService } from 'src/admins/admins.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(forwardRef(() => AdminsService))
    private readonly adminsService: AdminsService,
  ) {}

  private userSockets = new Map<string, string>();

  async handleConnection(client: Socket): Promise<void> {
    const adminId = client.handshake.query.adminId as string;
    if (adminId) {
      this.userSockets.set(adminId, client.id);

      try {
        // Fetch branches for this admin and join corresponding rooms
        const branches = await this.adminsService.findBranchesByAdminId(adminId);
        branches.forEach((branch: { id: string }) => {
          const roomName = `branch:${branch.id}`;
          void client.join(roomName);
        });
      } catch (error) {
        // Log error but don't disconnect
        console.error(`Error joining rooms for admin ${adminId}:`, error);
      }
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

  /**
   * Broadcasts a notification to all admins in a specific branch room.
   */
  broadcastToBranch<M>(branchId: string, payload: BroadcastMessage<M>): void {
    const roomName = `branch:${branchId}`;
    this.server.to(roomName).emit('notification', payload);
  }

  /**
   * Internal helper for direct targeted messaging (legacy support)
   */
  broadcastToAdmins<M>(adminIds: string[], payload: BroadcastMessage<M>): void {
    for (const adminId of adminIds) {
      const socketId = this.userSockets.get(adminId);
      if (socketId) {
        this.server.to(socketId).emit('notification', payload);
      }
    }
  }
}
