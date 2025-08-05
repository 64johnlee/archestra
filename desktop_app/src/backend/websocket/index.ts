import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';

import { WebSocketMessage } from '@types';

class WebSocketService {
  private fastify: FastifyInstance | null = null;
  private connections: Set<WebSocket> = new Set();

  initialize(fastifyInstance: FastifyInstance) {
    this.fastify = fastifyInstance;
  }

  addConnection(socket: WebSocket) {
    this.connections.add(socket);

    socket.on('close', () => {
      this.connections.delete(socket);
    });
  }

  removeConnection(socket: WebSocket) {
    this.connections.delete(socket);
  }

  broadcast(message: WebSocketMessage) {
    const messageStr = JSON.stringify(message);

    this.connections.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(messageStr);
      }
    });
  }
}

export default new WebSocketService();
