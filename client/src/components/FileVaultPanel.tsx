import React, { useRef, useState, useEffect } from "react";
import { Upload, Trash2, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import type { File as FileType } from "@shared/types";

interface FileVaultPanelProps {
  onFileUploaded?: (fileKey: string) => void;
}

export function FileVaultPanel({ onFileUploaded }: FileVaultPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const { data: files = [], refetch } = trpc.files.list.useQuery();
  const uploadMutation = trpc.files.upload.useMutation();
  const deleteMutation = trpc.files.delete.useMutation();

  // WebSocket for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/api/ws`);

    ws.onopen = () => {
      console.log("[WebSocket] FileVaultPanel connected");
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "file_update") {
        console.log("[WebSocket] Received file_update:", message.files);
        // Update files directly from the broadcast
        refetch(); // Re-fetch to ensure consistency for now, can optimize later
      } else if (message.type === "file_notification") {
        console.log("[WebSocket] Received file_notification:", message);
        // A specific file was created or deleted, refetch to update list
        refetch();
      }
    };

    ws.onclose = () => {
      console.log("[WebSocket] FileVaultPanel disconnected");
    };

    ws.onerror = (error) => {
      console.error("[WebSocket] FileVaultPanel error:", error);
    };

    return () => {
      ws.close();
    };
  }, [refetch]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    droppedFiles.forEach(file => uploadFile(file));
  };

  const uploadFile = async (file: File) => {
    try {
      setUploadProgress(0);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileData: base64,
          mimeType: file.type,
        });
        
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(0), 1000);
        
        // refetch(); // Removed, WebSocket will trigger update
        onFileUploaded?.(result.fileKey);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    selectedFiles.forEach(file => uploadFile(file));
  };

  const handleDelete = async (fileId: number) => {
    try {
      await deleteMutation.mutateAsync({ fileId });
      // refetch(); // Removed, WebSocket will trigger update
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950 border-l border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-slate-100">File Vault</h2>
      </div>

      {/* Upload area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`m-4 p-6 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
          isDragging
            ? "border-cyan-400 bg-cyan-400/10"
            : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-2"
        >
          <Upload className="w-6 h-6 text-slate-400" />
          <p className="text-sm text-slate-300">Drag files or click to upload</p>
        </div>

        {uploadProgress > 0 && (
          <div className="mt-3 w-full bg-slate-700 rounded-full h-1 overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-4">
        {files.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No files uploaded</p>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <File className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300 truncate">{file.fileName}</span>
                </div>
                
                <button
                  onClick={() => handleDelete(file.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-400"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
