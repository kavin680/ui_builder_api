import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { OnApplicationShutdown, Logger } from '@nestjs/common';
import { SocketTelemetryUpdateDto, SocketTelemetryBatchDto } from '../common/dto/websocket/telemetry-update.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class VariablesGateway implements OnApplicationShutdown {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(VariablesGateway.name);

  onApplicationShutdown() {
    this.logger.log('VariablesGateway: Disconnecting WebSocket clients actively.');
    if (this.server && typeof this.server.disconnectSockets === 'function') {
      this.server.disconnectSockets(true);
    }
  }

  emitBulk(updates: SocketTelemetryUpdateDto[]) {
    if (!updates || updates.length === 0) return;

    try {
      const batch = new SocketTelemetryBatchDto({
        data: updates,
      });

      this.server.emit('variableReadingUpdated', batch);
    } catch (err) {
      this.logger.error(`Failed to emit variableReadingUpdated: ${err.message}`);
    }
  }
}
