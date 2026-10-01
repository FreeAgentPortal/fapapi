import { parseProfileIdentity, resolveSocketProfile } from './profileAccess';
import { ProfileSocket, profileKey } from './types';

export default async function setupSocket(socket: ProfileSocket, payload: unknown, onChange: () => void): Promise<void> {
  const revision = ++socket.data.setupRevision;
  try {
    const identity = parseProfileIdentity(payload);
    if (socket.data.profile && profileKey(socket.data.profile) !== profileKey(identity)) {
      delete socket.data.profile;
      onChange();
    }
    await resolveSocketProfile(socket, identity);
    // An earlier lookup must not resurrect a disconnected or subsequently changed identity.
    if (!socket.connected || socket.data.setupRevision !== revision) return;
    const changed = !socket.data.profile;
    socket.data.profile = identity;
    socket.emit('connected', identity);
    if (changed) onChange();
  } catch {
    if (socket.data.setupRevision !== revision) return;
    delete socket.data.profile;
    onChange();
    socket.disconnect(true);
  }
}
