import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquareText, Mic, MicOff, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { requestVoiceAssistantReply } from '../services/voiceAssistant';
import type { ChatMessage } from '../services/ai';
import { useFarmStore } from '../store';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

const DUPLICATE_TRANSCRIPT_WINDOW_MS = 1500;
const HISTORY_LIMIT = 6;
const MAX_SPEECH_CHUNK_LENGTH = 220;

export const VoiceAssistant: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [replyPreview, setReplyPreview] = useState('');
  const [textPrompt, setTextPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sessionActiveRef = useRef(false);
  const processingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const conversationHistoryRef = useRef<ChatMessage[]>([]);
  const lastSubmittedRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const speechSequenceRef = useRef(0);
  const speechPrimedRef = useRef(false);

  const { selectedFarm, farms } = useFarmStore();

  const stopRecognition = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    try {
      recognition.stop();
    } catch {
      // ignore browser recognition stop race
    }
  };

  const stopSpeech = () => {
    speechSequenceRef.current += 1;
    activeUtteranceRef.current = null;
    setIsSpeaking(false);
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
    }
  };

  const loadVoices = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return [];
    }

    const voices = window.speechSynthesis.getVoices();
    voicesRef.current = voices;
    return voices;
  };

  const getPreferredVoice = () => {
    const voices = voicesRef.current.length > 0 ? voicesRef.current : loadVoices();

    return (
      voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-rw')) ||
      voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-us')) ||
      voices.find((voice) => voice.lang?.toLowerCase().startsWith('en')) ||
      voices.find((voice) => voice.default) ||
      null
    );
  };

  const normalizeReplyForSpeech = (reply: string) =>
    reply
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

  const chunkSpeechText = (reply: string) => {
    const normalizedReply = normalizeReplyForSpeech(reply);
    if (!normalizedReply) {
      return [];
    }

    const rawSegments = normalizedReply
      .split(/(?<=[.!?])\s+|\n+/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    const chunks: string[] = [];

    for (const segment of rawSegments) {
      if (segment.length <= MAX_SPEECH_CHUNK_LENGTH) {
        chunks.push(segment);
        continue;
      }

      const words = segment.split(/\s+/);
      let currentChunk = '';

      for (const word of words) {
        const candidate = currentChunk ? `${currentChunk} ${word}` : word;
        if (candidate.length > MAX_SPEECH_CHUNK_LENGTH && currentChunk) {
          chunks.push(currentChunk);
          currentChunk = word;
        } else {
          currentChunk = candidate;
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }
    }

    return chunks;
  };

  const primeSpeechPlayback = async () =>
    new Promise<boolean>((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve(false);
        return;
      }

      if (speechPrimedRef.current) {
        window.speechSynthesis.resume();
        resolve(true);
        return;
      }

      try {
        loadVoices();
        const primer = new SpeechSynthesisUtterance('.');
        primer.volume = 0;
        primer.rate = 1;
        primer.pitch = 1;
        primer.onend = () => {
          speechPrimedRef.current = true;
          resolve(true);
        };
        primer.onerror = () => {
          resolve(false);
        };

        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(primer);

        window.setTimeout(() => {
          if (!speechPrimedRef.current) {
            speechPrimedRef.current = true;
            resolve(true);
          }
        }, 200);
      } catch {
        resolve(false);
      }
    });

  const cleanupSession = () => {
    sessionActiveRef.current = false;
    processingRef.current = false;
    conversationHistoryRef.current = [];
    lastSubmittedRef.current = { text: '', at: 0 };
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    stopRecognition();
    stopSpeech();
    setIsSessionActive(false);
    setIsListening(false);
    setIsProcessing(false);
    setTranscript('');
    setReplyPreview('');
    setTextPrompt('');
  };

  const startListening = () => {
    if (!sessionActiveRef.current || processingRef.current) return;

    const recognition = recognitionRef.current;
    if (!recognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      setError(null);
      setIsListening(true);
      recognition.start();
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      setError('Failed to start microphone session.');
      setIsListening(false);
    }
  };

  const speakReply = async (reply: string) =>
    new Promise<void>(async (resolve) => {
      if (typeof window === 'undefined' || !reply.trim() || !audioEnabled) {
        resolve();
        return;
      }

      if (!('speechSynthesis' in window)) {
        setError('This browser can show AI text, but speech playback is not supported.');
        resolve();
        return;
      }

      const speechReady = await primeSpeechPlayback();
      if (!speechReady) {
        setError('AI replied, but browser speech is unavailable. You can still read the reply.');
        resolve();
        return;
      }

      stopSpeech();
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const chunks = chunkSpeechText(reply);
      if (chunks.length === 0) {
        resolve();
        return;
      }

      const sequenceId = speechSequenceRef.current;
      const preferredVoice = getPreferredVoice();
      let chunkIndex = 0;

      const speakChunk = () => {
        if (speechSequenceRef.current !== sequenceId) {
          resolve();
          return;
        }

        const chunk = chunks[chunkIndex];
        if (!chunk) {
          activeUtteranceRef.current = null;
          setIsSpeaking(false);
          resolve();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = preferredVoice?.lang || 'en-US';
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
        };

        utterance.onend = () => {
          if (speechSequenceRef.current !== sequenceId) {
            resolve();
            return;
          }

          chunkIndex += 1;
          if (chunkIndex >= chunks.length) {
            activeUtteranceRef.current = null;
            setIsSpeaking(false);
            resolve();
            return;
          }

          window.setTimeout(() => {
            speakChunk();
          }, 60);
        };

        utterance.onerror = () => {
          activeUtteranceRef.current = null;
          setIsSpeaking(false);
          setError('AI replied, but speech playback failed. You can use Replay or read the text reply.');
          resolve();
        };

        activeUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);

        window.setTimeout(() => {
          if (
            speechSequenceRef.current === sequenceId &&
            activeUtteranceRef.current === utterance &&
            !window.speechSynthesis.speaking &&
            !window.speechSynthesis.pending
          ) {
            try {
              window.speechSynthesis.cancel();
              window.speechSynthesis.resume();
              window.speechSynthesis.speak(utterance);
            } catch {
              setError('AI replied, but browser audio output did not start.');
              activeUtteranceRef.current = null;
              setIsSpeaking(false);
              resolve();
            }
          }
        }, 250);
      };

      speakChunk();
    });

  const processQuestion = async (question: string) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || processingRef.current) return;

    processingRef.current = true;
    setIsProcessing(true);
    setIsListening(false);
    setError(null);
    setTranscript(trimmedQuestion);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    conversationHistoryRef.current = [
      ...conversationHistoryRef.current,
      { role: 'user', content: trimmedQuestion, timestamp: new Date().toISOString() },
    ].slice(-HISTORY_LIMIT);

    try {
      const farmId = selectedFarm?.id || farms[0]?.id;
      const response = await requestVoiceAssistantReply(
        {
          message: trimmedQuestion,
          conversationHistory: conversationHistoryRef.current,
          farmId,
        },
        controller.signal
      );

      const reply = response.reply || 'I could not generate a voice response right now.';
      setReplyPreview(reply);
      setTextPrompt('');

      conversationHistoryRef.current = [
        ...conversationHistoryRef.current,
        { role: 'assistant', content: reply, timestamp: new Date().toISOString() },
      ].slice(-HISTORY_LIMIT);

      await speakReply(reply);
    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
        return;
      }

      console.error('Voice assistant request failed:', error);
      setError('Unable to reach the voice assistant. Please try again.');
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
      abortControllerRef.current = null;

      if (sessionActiveRef.current) {
        window.setTimeout(() => {
          startListening();
        }, 250);
      }
    }
  };

  const ensureRecognition = () => {
    if (recognitionRef.current || typeof window === 'undefined') {
      return true;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setError('Speech recognition is not supported in this browser.');
      return false;
    }

    const recognition = new SpeechRecognitionCtor() as SpeechRecognitionLike;
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const result = event?.results?.[event.resultIndex ?? 0]?.[0]?.transcript || '';
      const finalText = String(result).trim();

      if (!finalText) return;

      const now = Date.now();
      if (
        lastSubmittedRef.current.text === finalText &&
        now - lastSubmittedRef.current.at < DUPLICATE_TRANSCRIPT_WINDOW_MS
      ) {
        return;
      }

      lastSubmittedRef.current = { text: finalText, at: now };
      void processQuestion(finalText);
    };

    recognition.onerror = (event: any) => {
      const errorCode = event?.error;
      console.error('Speech recognition error:', event);
      setIsListening(false);

      if (errorCode === 'no-speech') {
        if (sessionActiveRef.current && !processingRef.current) {
          window.setTimeout(() => startListening(), 250);
        }
        return;
      }

      if (errorCode === 'aborted') {
        return;
      }

      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
        setError('Microphone access was blocked. Check browser microphone permissions.');
      } else {
        setError('Microphone capture failed. Please try again.');
      }

      sessionActiveRef.current = false;
      setIsSessionActive(false);
    };

    recognition.onend = () => {
      setIsListening(false);

      if (sessionActiveRef.current && !processingRef.current && !activeUtteranceRef.current) {
        window.setTimeout(() => startListening(), 250);
      }
    };

    recognitionRef.current = recognition;
    return true;
  };

  const startSession = () => {
    if (!ensureRecognition()) return;

    conversationHistoryRef.current = [];
    lastSubmittedRef.current = { text: '', at: 0 };
    sessionActiveRef.current = true;
    setIsSessionActive(true);
    setReplyPreview('');
    setTranscript('');
    setError(null);
    void primeSpeechPlayback();
    startListening();
  };

  const handleManualSubmit = () => {
    if (!textPrompt.trim()) return;
    sessionActiveRef.current = true;
    setIsSessionActive(true);
    stopRecognition();
    void primeSpeechPlayback();
    void processQuestion(textPrompt.trim());
  };

  const handleReplayReply = () => {
    if (!replyPreview.trim()) return;
    void primeSpeechPlayback();
    void speakReply(replyPreview);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    loadVoices();
    const synth = window.speechSynthesis;
    const handleVoicesChanged = () => {
      loadVoices();
    };

    synth.onvoiceschanged = handleVoicesChanged;

    return () => {
      cleanupSession();
      recognitionRef.current = null;
      synth.onvoiceschanged = null;
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-4">
      {error && (
        <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg shadow-lg text-sm mb-2 animate-fade-in max-w-xs">
          {error}
        </div>
      )}

      {isSessionActive && (
        <div className="w-[22rem] rounded-[1.75rem] border border-[#9BC53D]/20 bg-[radial-gradient(circle_at_top,#3f7d35,#20461d_60%,#163214)] text-white shadow-2xl mb-2 animate-slide-up overflow-hidden">
          <div className="px-4 py-4 border-b border-white/10 bg-white/5 backdrop-blur-md">
            <div className="flex justify-between items-center">
              <span className="font-semibold flex items-center gap-2 tracking-tight">
                <Sparkles className="h-4 w-4 text-yellow-300" />
                Keza Voice
              </span>
              <button onClick={cleanupSession} className="hover:bg-white/20 rounded-full p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-green-100/80">
              <span className={`inline-block h-2 w-2 rounded-full ${isListening ? 'bg-emerald-300' : isProcessing ? 'bg-yellow-300' : 'bg-white/40'}`} />
              {isSpeaking ? 'Speaking' : isProcessing ? 'Responding' : isListening ? 'Listening' : 'Ready'}
            </div>
          </div>

          <div className="p-4 space-y-4">
            <p className="text-xs text-green-50/90 leading-relaxed">
              {isProcessing
                ? 'Preparing a spoken answer.'
                : isListening
                  ? 'Ask about your selected farm, soil, pests, or weather.'
                  : 'Use your microphone or type a question below.'}
            </p>

            {transcript && (
              <div className="rounded-2xl bg-white/10 px-3 py-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-green-100/75">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  You asked
                </div>
                <p className="mt-1 text-[12px] text-white/95 line-clamp-3">"{transcript}"</p>
              </div>
            )}

            {replyPreview && (
              <div className="rounded-2xl bg-white/12 px-3 py-3 border border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-green-100/80">
                    <Volume2 className="h-3.5 w-3.5" />
                    Latest reply
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setAudioEnabled((current) => !current)}
                      className="text-[11px] font-semibold text-green-100 hover:text-white"
                    >
                      {audioEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={handleReplayReply}
                      className="text-[11px] font-semibold text-yellow-200 hover:text-yellow-100"
                    >
                      Replay
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-[12px] text-green-50/95 leading-5 max-h-24 overflow-auto pr-1">
                  {replyPreview}
                </p>
              </div>
            )}

            <div className="rounded-2xl bg-black/15 border border-white/10 p-2">
              <div className="flex items-end gap-2">
                <textarea
                  value={textPrompt}
                  onChange={(event) => setTextPrompt(event.target.value)}
                  placeholder="Type a farming question..."
                  rows={2}
                  className="min-h-[56px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white placeholder:text-green-100/45 outline-none"
                />
                <button
                  onClick={handleManualSubmit}
                  disabled={!textPrompt.trim() || isProcessing}
                  className="h-10 w-10 rounded-xl bg-[#9BC53D] text-[#163214] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send question"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-1 justify-center h-4 items-center">
              <div className={`w-1 ${isListening ? 'bg-white/80' : 'bg-white/30'} h-2 rounded-full`} />
              <div className={`w-1 ${isProcessing ? 'bg-yellow-300 animate-pulse' : 'bg-white/60'} h-4 rounded-full`} />
              <div className={`w-1 ${isListening ? 'bg-white/80' : 'bg-white/30'} h-2 rounded-full`} />
            </div>
          </div>
        </div>
      )}

      <button
        onClick={isSessionActive ? cleanupSession : startSession}
        disabled={isProcessing && !isSessionActive}
        className={`h-14 w-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-105 ${
          isSessionActive ? 'bg-red-500 hover:bg-red-600' : 'bg-[#2D5A27] hover:bg-[#1a3817]'
        } text-white`}
        aria-label="Toggle Voice Assistant"
      >
        {isProcessing ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : isSessionActive ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </button>
    </div>
  );
};
