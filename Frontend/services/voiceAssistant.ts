import { AxiosResponse } from 'axios';
import apiClient, { ApiResponse } from './apiClient';
import { sendChatMessage, type ChatMessage } from './ai';

export interface VoiceAssistantRequest {
  message: string;
  conversationHistory?: ChatMessage[];
  farmId?: string;
}

export interface VoiceAssistantResponse {
  reply: string;
  suggestions: string[];
  confidence: number;
  channel?: string;
}

function normalizeVoiceResponse(payload: unknown): VoiceAssistantResponse {
  const response = (payload ?? {}) as Partial<VoiceAssistantResponse>;

  return {
    reply: typeof response.reply === 'string' ? response.reply : '',
    suggestions: Array.isArray(response.suggestions) ? response.suggestions : [],
    confidence: typeof response.confidence === 'number' ? response.confidence : 0,
    channel: typeof response.channel === 'string' ? response.channel : 'voice',
  };
}

function getResponsePayload<T>(response: AxiosResponse<ApiResponse<T> | T>): unknown {
  const body = response.data as ApiResponse<T> | T;

  if (body && typeof body === 'object' && 'data' in (body as ApiResponse<T>)) {
    return (body as ApiResponse<T>).data;
  }

  return body;
}

export const requestVoiceAssistantReply = async (
  request: VoiceAssistantRequest,
  signal?: AbortSignal
): Promise<VoiceAssistantResponse> => {
  try {
    const response: AxiosResponse<ApiResponse<VoiceAssistantResponse>> = await apiClient.post(
      '/ai/voice-assistant',
      request,
      { signal }
    );

    return normalizeVoiceResponse(getResponsePayload(response));
  } catch (error: any) {
    const status = error?.response?.status;
    const shouldFallback =
      status === 404 ||
      status === 405 ||
      status === 501 ||
      status === 503 ||
      error?.code === 'ERR_NETWORK';

    if (!shouldFallback) {
      throw error;
    }

    const fallback = await sendChatMessage({
      message: request.message,
      conversationHistory: request.conversationHistory,
      farmId: request.farmId,
    });

    return {
      reply: fallback.reply,
      suggestions: fallback.suggestions,
      confidence: fallback.confidence,
      channel: 'chat-fallback',
    };
  }
};

const voiceAssistantService = {
  requestVoiceAssistantReply,
};

export default voiceAssistantService;
