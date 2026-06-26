import { useCallback, useRef, useState } from "react";

interface UseTextToSpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(
    (text: string) => {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options.rate ?? 1;
      utterance.pitch = options.pitch ?? 1;
      utterance.volume = options.volume ?? 1;

      // Try to find a good voice (prefer natural-sounding ones)
      if (options.voice) {
        utterance.voice = options.voice;
      } else {
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(
          v => v.lang.startsWith("en") && v.name.includes("Google")
        ) || voices.find(v => v.lang.startsWith("en")) || voices[0];
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [options]
  );

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const pause = useCallback(() => {
    if (isSpeaking) {
      window.speechSynthesis.pause();
    }
  }, [isSpeaking]);

  const resume = useCallback(() => {
    if (isSpeaking) {
      window.speechSynthesis.resume();
    }
  }, [isSpeaking]);

  return {
    isSpeaking,
    speak,
    stop,
    pause,
    resume,
  };
}
