export interface Message {
  id: number;
  userId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface Task {
  id: number;
  userId: number;
  taskId: string;
  title: string;
  description?: string | null;
  status: "queued" | "running" | "completed" | "failed";
  result?: string | null;
  error?: string | null;
  createdAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface File {
  id: number;
  userId: number;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}
