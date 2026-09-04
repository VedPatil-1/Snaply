import { io } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../config';

let socketInstance = null;
let lifecycleBound = false;
let joinedUserId = null;

function bindLifecycle(socket) {
  if (lifecycleBound) return;
  lifecycleBound = true;

  socket.on('connect', () => {
    console.log('[Snaply] socket connected', socket.id, SOCKET_BASE_URL);
    if (joinedUserId) {
      socket.emit('join_user_room', joinedUserId);
    }
  });

  socket.on('connect_error', (error) => {
    console.error('[Snaply] socket connect_error', SOCKET_BASE_URL, error?.message || error);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Snaply] socket disconnected', reason);
  });
}

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(SOCKET_BASE_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    bindLifecycle(socketInstance);
  }

  return socketInstance;
}

export function connectSocket(userId) {
  const socket = getSocket();
  if (userId) {
    joinedUserId = String(userId);
    socket.auth = { userId: joinedUserId };
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (!socketInstance) return;
  socketInstance.disconnect();
}

export const socket = new Proxy(
  {},
  {
    get(_target, prop) {
      const instance = getSocket();
      const value = instance[prop];
      return typeof value === 'function' ? value.bind(instance) : value;
    },
    set(_target, prop, value) {
      getSocket()[prop] = value;
      return true;
    },
  }
);

export default socket;
