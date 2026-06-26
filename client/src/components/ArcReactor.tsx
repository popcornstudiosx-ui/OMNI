import React, { useEffect, useState } from "react";
import { Mic, MicOff } from "lucide-react";

interface ArcReactorProps {
  isListening: boolean; // This now indicates if the mic is *actively* listening for speech (after VAD)
  isRecording: boolean; // This indicates if the MediaRecorder is active
  isProcessing: boolean; // This indicates if audio is being processed (upload/transcribe)
  isSpeaking: boolean;
  onMicToggle: () => void;
}

export function ArcReactor({ isListening, isRecording, isProcessing, isSpeaking, onMicToggle }: ArcReactorProps) {
  const [glowIntensity, setGlowIntensity] = useState(0.5);

  useEffect(() => {
    if (!isRecording && !isProcessing && !isSpeaking) {
      setGlowIntensity(0.5);
      return;
    }

    let animationFrame: number;
    const animate = () => {
      setGlowIntensity(prev => {
        const next = prev + (Math.random() - 0.5) * 0.15;
        return Math.max(0.3, Math.min(1, next));
      });
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isRecording, isProcessing, isSpeaking]);

  const glowColor = isSpeaking ? "#00ff88" : (isRecording || isProcessing) ? "#00ccff" : "#0088ff";
  const glowRadius = 120 + glowIntensity * 40;

  return (
    <div className="flex flex-col items-center justify-center gap-8">
      <div className="relative w-64 h-64">
        {/* Outer glow */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 256 256"
          style={{
            filter: `drop-shadow(0 0 ${glowRadius}px ${glowColor})`,
          }}
        >
          {/* Outer ring */}
          <circle
            cx="128"
            cy="128"
            r="120"
            fill="none"
            stroke={glowColor}
            strokeWidth="2"
            opacity={glowIntensity * 0.6}
          />

          {/* Middle ring */}
          <circle
            cx="128"
            cy="128"
            r="100"
            fill="none"
            stroke={glowColor}
            strokeWidth="1.5"
            opacity={glowIntensity * 0.4}
          />

          {/* Inner ring */}
          <circle
            cx="128"
            cy="128"
            r="80"
            fill="none"
            stroke={glowColor}
            strokeWidth="1"
            opacity={glowIntensity * 0.3}
          />

          {/* Core circle */}
          <circle
            cx="128"
            cy="128"
            r="60"
            fill={glowColor}
            opacity={glowIntensity * 0.8}
          />

          {/* Arc segments */}
          {[0, 90, 180, 270].map((angle) => (
            <g key={angle}>
              <path
                d={`M 128 128 L ${128 + 90 * Math.cos((angle * Math.PI) / 180)} ${
                  128 + 90 * Math.sin((angle * Math.PI) / 180)
                }`}
                stroke={glowColor}
                strokeWidth="2"
                opacity={glowIntensity * 0.7}
              />
            </g>
          ))}
        </svg>

        {/* Microphone button overlay */}
        <button
          onClick={onMicToggle}
          className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-gradient-to-br from-slate-900 to-slate-950 border-2 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{
            borderColor: glowColor,
            boxShadow: `0 0 20px ${glowColor}`,
          }}
        >
          {(isRecording || isProcessing) ? (
            <Mic className="w-8 h-8" style={{ color: glowColor }} />
          ) : (
            <MicOff className="w-8 h-8" style={{ color: glowColor }} />
          )}
        </button>
      </div>

      {/* Status text */}
      <div className="text-center">
        <p className="text-sm font-medium text-slate-400">
          {isSpeaking ? "Speaking..." : isProcessing ? "Processing..." : isRecording ? "Listening..." : "Ready"}
        </p>
      </div>
    </div>
  );
}
