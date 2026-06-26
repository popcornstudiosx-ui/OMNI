import React, { useEffect, useState, useRef } from "react";
import { CheckCircle, AlertCircle, Clock, Loader } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { Task } from "@shared/types";

interface TaskUpdate {
  type: "task_update" | "task_notification";
  tasks?: Task[];
  taskId?: string;
  status?: string;
}

export function TaskMonitor() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const initializedRef = useRef(false);
  const { data: initialTasks = [] } = trpc.tasks.list.useQuery();

  // Load initial tasks only once
  useEffect(() => {
    if (!initializedRef.current && initialTasks.length > 0) {
      setTasks(initialTasks);
      initializedRef.current = true;
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message: TaskUpdate = JSON.parse(event.data);
        
        if (message.type === "task_update" && message.tasks) {
          setTasks(message.tasks);
        } else if (message.type === "task_notification") {
          console.log(`Task ${message.taskId} status: ${message.status}`);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case "running":
        return <Loader className="w-4 h-4 text-cyan-400 animate-spin" />;
      case "queued":
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-400";
      case "failed":
        return "text-red-400";
      case "running":
        return "text-cyan-400";
      case "queued":
        return "text-yellow-400";
      default:
        return "text-slate-400";
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950 border-l border-slate-700">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Task Monitor</h2>
        <div className="w-2 h-2 rounded-full" style={{
          backgroundColor: wsConnected ? "#00ff88" : "#ff0000",
        }} />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No tasks</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.taskId}
                className="p-3 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors border border-slate-700"
              >
                <div className="flex items-start gap-3">
                  {getStatusIcon(task.status)}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{task.title}</p>
                    <p className={`text-xs mt-1 ${getStatusColor(task.status)}`}>
                      {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </p>
                    
                    {task.result && (
                      <p className="text-xs text-slate-400 mt-2 line-clamp-2">{task.result}</p>
                    )}
                    
                    {task.error && (
                      <p className="text-xs text-red-400 mt-2 line-clamp-2">{task.error}</p>
                    )}
                  </div>
                </div>

                {task.completedAt && (
                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(task.completedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
