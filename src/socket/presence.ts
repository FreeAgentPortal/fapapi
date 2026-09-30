import logger from '../utils/logger';
import { resolveRegisteredProfiles, resolveSocketProfile, SocketAccessError } from './profileAccess';
import { PresenceStore, PRESENCE_REFRESH_MS } from './presenceStore';
import { ActiveProfile, PRESENCE_ROOM, ProfileServer, ProfileSocket, profileKey } from './types';

export class ProfilePresence {
  private readonly store = new PresenceStore();
  private readonly timer: NodeJS.Timeout;
  private pending = false;
  private running?: Promise<void>;
  private lastSnapshot?: string;
  private readonly delivered = new Map<string, string>();
  private closed = false;

  constructor(private readonly io: ProfileServer) {
    this.timer = setInterval(() => { if (!this.running) this.changed(); }, PRESENCE_REFRESH_MS);
    this.timer.unref();
    io.engine.on('close', () => {
      this.closed = true;
      clearInterval(this.timer);
      this.delivered.clear();
      // Serialize cleanup after a pending write so it cannot recreate this lease.
      void (this.running || Promise.resolve()).then(() => this.store.synchronize([])).catch(() => {});
    });
  }

  changed(): void {
    if (this.closed) return;
    this.pending = true;
    if (!this.running) {
      this.running = this.refreshLoop().finally(() => {
        this.running = undefined;
        if (this.pending && !this.closed) this.changed();
      });
    }
  }

  unsubscribe(socket: ProfileSocket): void {
    ++socket.data.presenceRevision;
    delete socket.data.presenceSubscription;
    void socket.leave(PRESENCE_ROOM);
    this.delivered.delete(socket.id);
  }

  async subscribe(socket: ProfileSocket): Promise<void> {
    const revision = ++socket.data.presenceRevision;
    const setupRevision = socket.data.setupRevision;
    try {
      const identity = socket.data.profile;
      if (!identity) throw new SocketAccessError('Profile setup required.');
      const access = await resolveSocketProfile(socket, identity);
      if (!this.isCurrent(socket, revision, setupRevision)) return;
      if (!access.canReportPresence) throw new SocketAccessError('Presence reporting denied.');
      await socket.join(PRESENCE_ROOM);
      if (!this.isCurrent(socket, revision, setupRevision)) {
        // Unsubscribe/identity changes invalidate a pending join.
        if (socket.data.presenceSubscription !== socket.data.presenceRevision) void socket.leave(PRESENCE_ROOM);
        return;
      }
      socket.data.presenceSubscription = revision;
      this.delivered.delete(socket.id); // Every subscription/retry gets a complete snapshot.
      this.changed();
    } catch (error) {
      if (!this.isCurrent(socket, revision, setupRevision)) return;
      this.error(socket, error instanceof SocketAccessError ? 'FORBIDDEN' : 'UNAVAILABLE');
    }
  }

  private isCurrent(socket: ProfileSocket, revision: number, setupRevision: number): boolean {
    return socket.connected && socket.data.presenceRevision === revision && socket.data.setupRevision === setupRevision;
  }

  private error(socket: ProfileSocket, code: 'FORBIDDEN' | 'UNAVAILABLE'): void {
    if (code === 'FORBIDDEN') this.unsubscribe(socket);
    else this.delivered.delete(socket.id);
    if (socket.connected) socket.emit('presence:error', { code });
  }

  private async refreshLoop(): Promise<void> {
    while (this.pending && !this.closed) {
      this.pending = false;
      try {
        await this.refresh();
      } catch {
        // A failed query/write is never published as an empty successful snapshot.
        for (const socket of this.subscribers()) this.error(socket, 'UNAVAILABLE');
        logger.warn('[SocketPresence] Presence refresh unavailable.');
      }
    }
  }

  private subscribers(): ProfileSocket[] {
    return [...this.io.sockets.sockets.values()].filter((socket) => socket.connected &&
      socket.rooms.has(PRESENCE_ROOM) && socket.data.presenceSubscription === socket.data.presenceRevision);
  }

  private async refresh(): Promise<void> {
    const sockets = [...this.io.sockets.sockets.values()];
    const revisions = new Map(sockets.map((socket) => [socket.id, socket.data.setupRevision]));
    const resolved = await resolveRegisteredProfiles(sockets);
    // Discard a read that raced a setup/disconnect; retry against the current membership.
    if (sockets.some((socket) => revisions.get(socket.id) !== socket.data.setupRevision) || this.pending) {
      this.pending = true;
      return;
    }
    const profiles = new Map<string, ActiveProfile>();
    for (const socket of sockets) {
      if (!socket.connected || !socket.data.profile) continue;
      const access = resolved.get(socket.id);
      if (!access) {
        if (socket.rooms.has(PRESENCE_ROOM)) this.error(socket, 'FORBIDDEN');
        delete socket.data.profile;
        ++socket.data.setupRevision;
        socket.disconnect(true);
        continue;
      }
      profiles.set(profileKey(access.profile), access.profile);
    }
    await this.store.synchronize([...profiles.values()]);
    if (this.closed) return;
    const subscribers = this.subscribers();
    if (!subscribers.length) return;
    const snapshot = await this.store.snapshot();
    const fingerprint = JSON.stringify(snapshot.profiles);
    const changed = fingerprint !== this.lastSnapshot;
    this.lastSnapshot = fingerprint;

    // Recheck the database before each publication; the earlier batch must not
    // authorize a reporting role that has since been revoked.
    await Promise.all(subscribers.map(async (socket) => {
      const revision = socket.data.presenceRevision;
      const setupRevision = socket.data.setupRevision;
      try {
        if (!socket.data.profile) throw new SocketAccessError('Profile setup required.');
        const access = await resolveSocketProfile(socket, socket.data.profile);
        if (!this.isCurrent(socket, revision, setupRevision) || !socket.rooms.has(PRESENCE_ROOM)) return;
        if (!access.canReportPresence) {
          this.error(socket, 'FORBIDDEN');
          return;
        }
        if (changed || this.delivered.get(socket.id) !== fingerprint) {
          socket.emit('presence:snapshot', snapshot);
          this.delivered.set(socket.id, fingerprint);
        }
      } catch (error) {
        if (this.isCurrent(socket, revision, setupRevision) && socket.rooms.has(PRESENCE_ROOM)) {
          this.error(socket, error instanceof SocketAccessError ? 'FORBIDDEN' : 'UNAVAILABLE');
        }
      }
    }));
  }
}
