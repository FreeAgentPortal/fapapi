const { Server } = require('socket.io');

let io: typeof Server | null = null;

export default {
  init: (server: any) => {
    io = new Server(server, {
      cors: {
        origin: '*', // Replace "*" with specific frontend URLs if needed for security
        methods: ['GET', 'POST'], // Define allowed methods
        allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
        credentials: true, // Allow cookies and other credentials
      },
      pingTimeout: 60000, // Keep the connection alive
    });
    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io is not initialized!');
    }
    return io;
  },
};
