import setupSocket from './setupSocket';
const colors = require('colors');

/**
 * @description Socket connection, this file is called from server.js and is used to handle socket connections and disconnections
 *              We can import other socket files here to handle socket events and emit socket events from here
 * @param {Object} io - Socket.io instance
 * @returns {void}
 *
 * @author Austin Howard
 * @since 1.0
 * @version 1.0
 */
export default (io: any) => {
  try {
    io.on('connection', (socket: any) => {
      socket.on('setup', (userData: object) => {
        setupSocket(socket, userData);
      });
      socket.on('disconnect', () => {
        // console.log('Socket disconnected');
      });
      socket.on('join', async (room: { roomId: string; user: any }) => {
        if (!room.roomId) return;
        // console.log(
        //   colors.green(`${room.user.fullName} has joined the room`) +
        //     colors.blue(` ${room.roomId}`)
        // );
        socket.join(room.roomId);
      });
      socket.on('leave', async (room: { roomId: string; user: string }) => {
        console.log(
          colors.yellow(`${room.user} has left the room`) +
            colors.blue(` ${room.roomId}`)
        );
        socket.leave(room.roomId);
      });
      socket.on('sendNewMessage', (room: any) => {
        // send the new message to the client
        socket.broadcast.to(room.roomId).emit('newMessage', room.message);
      });
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};
