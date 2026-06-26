import type { WebSocket } from "ws";
import * as db from "./db";

interface ClientConnection {
  userId: number;
  ws: WebSocket;
}

const connections: Map<string, ClientConnection> = new Map();
let statusCheckInterval: NodeJS.Timeout | null = null;

export function registerWebSocketClient(clientId: string, userId: number, ws: WebSocket) {
  connections.set(clientId, { userId, ws });
  
  if (!statusCheckInterval) {
    statusCheckInterval = setInterval(() => {
      broadcastTaskUpdates();
      broadcastFileUpdates(); // Also broadcast file updates periodically
    }, 1000);
  }
}

export function unregisterWebSocketClient(clientId: string) {
  connections.delete(clientId);
  
  if (connections.size === 0 && statusCheckInterval) {
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }
}

async function broadcastTaskUpdates() {
  const userTaskMap = new Map<number, any[]>();
  
  connections.forEach(({ userId }) => {
    if (!userTaskMap.has(userId)) {
      db.getTasksByUserId(userId).then(tasks => {
        userTaskMap.set(userId, tasks);
      });
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  connections.forEach(({ userId, ws }, clientId) => {
    if (ws.readyState === 1) {
      const tasks = userTaskMap.get(userId) || [];
      const message = {
        type: "task_update",
        tasks: tasks.map(t => ({
          taskId: t.taskId,
          title: t.title,
          status: t.status,
          result: t.result,
          error: t.error,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
        })),
      };
      
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to client ${clientId}:`, error);
        unregisterWebSocketClient(clientId);
      }
    }
  });
}

export async function broadcastFileUpdates() {
  const userFileMap = new Map<number, any[]>();
  
  connections.forEach(({ userId }) => {
    if (!userFileMap.has(userId)) {
      db.getFilesByUserId(userId).then(files => {
        userFileMap.set(userId, files);
      });
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  connections.forEach(({ userId, ws }, clientId) => {
    if (ws.readyState === 1) {
      const files = userFileMap.get(userId) || [];
      const message = {
        type: "file_update",
        files: files.map(f => ({
          id: f.id,
          fileName: f.fileName,
          fileKey: f.fileKey,
          fileUrl: f.fileUrl,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
          uploadedAt: f.uploadedAt,
        })),
      };
      
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to client ${clientId}:`, error);
        unregisterWebSocketClient(clientId);
      }
    }
  });
}

export function sendFileNotification(userId: number, fileId: number, action: "created" | "deleted") {
  connections.forEach(({ userId: connUserId, ws }) => {
    if (connUserId === userId && ws.readyState === 1) {
      const message = {
        type: "file_notification",
        fileId,
        action,
      };
      
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error("Failed to send file notification:", error);
      }
    }
  });
}

export function sendChatMessageNotification(userId: number, message: any) {
  connections.forEach(({ userId: connUserId, ws }) => {
    if (connUserId === userId && ws.readyState === 1) {
      const notification = {
        type: "chat_message",
        message,
      };
      try {
        ws.send(JSON.stringify(notification));
      } catch (error) {
        console.error("Failed to send chat message notification:", error);
      }
    }
  });
}

export function sendTaskNotification(userId: number, taskId: string, status: string) {
  connections.forEach(({ userId: connUserId, ws }) => {
    if (connUserId === userId && ws.readyState === 1) {
      const message = {
        type: "task_notification",
        taskId,
        status,
      };
      
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error("Failed to send notification:", error);
      }
    }
  });
}
