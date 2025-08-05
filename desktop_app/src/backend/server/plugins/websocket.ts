import fastifyWebsocket from '@fastify/websocket';
import { FastifyPluginAsync } from 'fastify';

import WebsocketService from '@backend/websocket';

/**
 * WebSocket plugin for real-time communication
 *
 * This plugin adds WebSocket support to Fastify, enabling real-time
 * bidirectional communication between the server and clients.
 * Used for broadcasting chat updates and other real-time events.
 */
const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  // Register the WebSocket plugin
  await fastify.register(fastifyWebsocket);

  // Initialize the WebSocket service with the Fastify instance
  WebsocketService.initialize(fastify);

  // Add WebSocket route
  fastify.get('/ws', { websocket: true }, async (socket, req) => {
    console.log('WebSocket client connected');

    // Handle connection close
    socket.on('close', () => {
      console.log('WebSocket client disconnected');
      WebsocketService.removeConnection(socket);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
};

export default websocketPlugin;
