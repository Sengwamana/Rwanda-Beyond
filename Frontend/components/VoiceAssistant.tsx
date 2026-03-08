import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, X, Sparkles } from 'lucide-react';
import { sendChatMessage } from '../services/ai';
import { useFarmStore } from '../store';

export const VoiceAssistant: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const shouldRestartRef = useRef(false);
  const { selectedFarm, farms } = useFarmStore();

  const cleanup = () => {
    shouldRestartRef.current = false;
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch (_) {
        // Ignore
      }
    }

    window.speechSynthesis.cancel();
    setIsActive(false);
    setIsProcessing(false);
  };

  const askAssistant = async (question: string) => {
    if (!question.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const farmId = selectedFarm?.id || farms[0]?.id;
      const response = await sendChatMessage({
        message: question,
        farmId,
      });

      const reply = response.reply || 'I could not generate a response right now.';
      const utterance = new SpeechSynthesisUtterance(reply);
      utterance.lang = 'en-US';
      utterance.onend = () => {
        setIsProcessing(false);
      };
      utterance.onerror = () => {
        setIsProcessing(false);
      };
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Voice assistant backend request failed:', err);
      setError('Unable to reach the AI assistant. Please try again.');
      setIsProcessing(false);
    }
  };

  const startSession = () => {
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      if (!recognitionRef.current) {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          let finalText = '';
          let interimText = '';

          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const text = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              finalText += text;
            } else {
              interimText += text;
            }
          }

          const currentText = (finalText || interimText).trim();
          if (currentText) {
            setTranscript(currentText);
          }

          if (finalText.trim()) {
            void askAssistant(finalText.trim());
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event);
          setError('Microphone capture failed. Check browser microphone permissions.');
          setIsActive(false);
          shouldRestartRef.current = false;
        };

        recognition.onend = () => {
          if (shouldRestartRef.current) {
            recognition.start();
          } else {
            setIsActive(false);
          }
        };

        recognitionRef.current = recognition;
      }

      shouldRestartRef.current = true;
      setError(null);
      setIsActive(true);
      recognitionRef.current.start();
    } catch (err) {
      console.error('Failed to start voice recognition:', err);
      setError('Failed to start microphone session.');
      cleanup();
    }
  };

  useEffect(() => {
    return () => {
      cleanup();
      recognitionRef.current = null;
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-4">
      {error && (
        <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg shadow-lg text-sm mb-2 animate-fade-in">
          {error}
        </div>
      )}

      {isActive && (
        <div className="bg-[#2D5A27] text-white p-4 rounded-2xl shadow-xl w-64 mb-2 animate-slide-up backdrop-blur-md bg-opacity-95">
            <div className="flex justify-between items-center mb-2">
                <span className="font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-300" /> 
                    Keza (Live)
                </span>
                <button onClick={cleanup} className="hover:bg-white/20 rounded-full p-1">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <p className="text-xs text-green-100 leading-relaxed">
                Listening... Ask about soil moisture, pest identification, or weather forecast.
            </p>
            {transcript && (
              <p className="mt-2 text-[11px] text-green-50/90 italic line-clamp-2">"{transcript}"</p>
            )}
            <div className="mt-3 flex gap-1 justify-center h-4 items-center">
                 {/* Simple Audio Visualizer Animation */}
                 <div className="w-1 bg-white/60 animate-[bounce_1s_infinite] h-2"></div>
                 <div className="w-1 bg-white/80 animate-[bounce_1.2s_infinite] h-4"></div>
                 <div className="w-1 bg-white/60 animate-[bounce_0.8s_infinite] h-2"></div>
            </div>
        </div>
      )}

      <button
        onClick={isActive ? cleanup : startSession}
        disabled={isProcessing}
        className={`h-14 w-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-105 ${
            isActive 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
            : 'bg-[#2D5A27] hover:bg-[#1a3817]'
        } text-white`}
        aria-label="Toggle Voice Assistant"
      >
        {isProcessing ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : isActive ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </button>
    </div>
  );
};
