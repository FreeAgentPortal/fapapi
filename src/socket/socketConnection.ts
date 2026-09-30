import setupSocket from './setupSocket';
import authenticateSocket from './authenticateSocket';
import { ProfilePresence } from './presence';
import { PRESENCE_ROOM, ProfileServer } from './types';
const colors = require('colors');

export default (io: ProfileServer) => {
  const presence = new ProfilePresence(io);
  io.use(authenticateSocket);
  io.on('connection', (socket) => {
    let expiryTimer: NodeJS.Timeout;
    const expireSession = () => {
      const remaining = socket.data.account.expiresAt - Date.now();
      if (remaining <= 0) {
        if (socket.rooms.has(PRESENCE_ROOM)) socket.emit('presence:error', { code: 'FORBIDDEN' });
        socket.disconnect(true);
        return;
      }
      expiryTimer = setTimeout(expireSession, Math.min(remaining, 2147483647));
      expiryTimer.unref();
    };
    expireSession();

    socket.on('setup', (payload: unknown) => {
      void setupSocket(socket, payload, () => {
        presence.unsubscribe(socket);
        presence.changed();
      });
    });
    socket.on('presence:subscribe', () => { void presence.subscribe(socket); });
    socket.on('presence:unsubscribe', () => presence.unsubscribe(socket));
    socket.on('disconnect', () => {
      clearTimeout(expiryTimer);
      ++socket.data.setupRevision;
      delete socket.data.profile;
      presence.unsubscribe(socket);
      presence.changed();
    });
    socket.on('join', async (room: { roomId: string; user: any }) => {
      if (typeof room?.roomId !== 'string' || !room.roomId || room.roomId === PRESENCE_ROOM) return;
      await socket.join(room.roomId);
    });
    socket.on('leave', async (room: { roomId: string; user: string }) => {
      if (typeof room?.roomId !== 'string' || !room.roomId || room.roomId === PRESENCE_ROOM) return;
      console.info(colors.yellow(`${room.user} has left the room`) + colors.blue(` ${room.roomId}`));
      await socket.leave(room.roomId);
    });
    socket.on('sendNewMessage', (room: any) => {
      if (typeof room?.roomId !== 'string' || !room.roomId || room.roomId === PRESENCE_ROOM) return;
      socket.broadcast.to(room.roomId).emit('newMessage', room.message);
    });
  });
};
