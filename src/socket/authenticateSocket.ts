import jwt from 'jsonwebtoken';
import User from '../modules/auth/model/User';
import { ProfileSocket } from './types';

export default async function authenticateSocket(socket: ProfileSocket, next: (error?: Error) => void): Promise<void> {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token || token.startsWith('Bearer ')) throw new Error();
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || typeof decoded.userId !== 'string' ||
        !/^[a-f\d]{24}$/.test(decoded.userId) || typeof decoded.exp !== 'number' || !Number.isFinite(decoded.exp)) throw new Error();
    const account = await User.findById(decoded.userId).select('_id isActive').lean();
    if (!account?.isActive || decoded.exp * 1000 <= Date.now()) throw new Error();
    socket.data.account = { userId: String(account._id), expiresAt: decoded.exp * 1000 };
    socket.data.setupRevision = 0;
    socket.data.presenceRevision = 0;
    next();
  } catch {
    const error = Object.assign(new Error('Socket authentication failed.'), { data: { code: 'UNAUTHORIZED' } });
    next(error);
  }
}
