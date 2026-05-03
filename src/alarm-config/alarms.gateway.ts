import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { OnApplicationShutdown, Logger } from '@nestjs/common';
import { SocketAlarmEventDto } from '../common/dto/websocket/alarm-event.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'alarms',
})
export class AlarmsGateway implements OnApplicationShutdown {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(AlarmsGateway.name);

  onApplicationShutdown() {
    this.logger.log('AlarmsGateway: Disconnecting WebSocket clients actively.');
    if (this.server && typeof this.server.disconnectSockets === 'function') {
      this.server.disconnectSockets(true);
    }
  }

  emitAlarmTriggered(alarm: SocketAlarmEventDto) {
    try {
      this.server.emit('alarm_triggered', alarm);
    } catch (err) {
      this.logger.error(`Failed to emit alarm_triggered: ${err.message}`);
    }
  }

  emitAlarmCleared(alarm: SocketAlarmEventDto) {
    try {
      this.server.emit('alarm_cleared', alarm);
    } catch (err) {
      this.logger.error(`Failed to emit alarm_cleared: ${err.message}`);
    }
  }

  emitAlarmAcknowledged(alarm: SocketAlarmEventDto) {
    try {
      this.server.emit('alarm_acknowledged', alarm);
    } catch (err) {
      this.logger.error(`Failed to emit alarm_acknowledged: ${err.message}`);
    }
  }
}
