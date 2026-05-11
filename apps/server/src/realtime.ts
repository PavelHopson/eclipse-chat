import type { Server as SocketServer } from "socket.io";

let io: SocketServer | null = null;

export function setSocketIO(server: SocketServer) {
  io = server;
}

export function emitMessageOnChannel(
  channelId: string,
  payload: { messageId: string; content: string; channelId: string; userId: string; displayName: string; createdAt: string },
) {
  io?.to(`channel:${channelId}`).emit("message:new", payload);
}
