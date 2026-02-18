/**
 * AI Service - Frontend integration with Gemini-powered AI endpoints
 * 
 * Provides methods for:
 * - Agricultural advice and Q&A
 * - Image analysis for crop health
 * - Interactive chat functionality
 * - Service health monitoring
 */

import apiClient, { ApiResponse } from './apiClient';
import { AxiosResponse } from 'axios';

export interface AgriculturalAdviceRequest {
  question: string;
  context?: {
    cropType?: string;
    location?: string;
    growthStage?: string;
    farmId?: string;
  };
}

export interface AgriculturalAdviceResponse {
  success: boolean;
  answer: string;
  suggestions: string[];
  relatedTopics: string[];
  confidence: number;
  sources: string[];
  aiProvider: string;
}

export interface ImageAnalysisRequest {
  imageUrl: string;
  context?: {
    cropType?: string;
    expectedGrowthStage?: string;
  };
}

export interface ImageAnalysisResponse {
  success: boolean;
  overallHealth: string;
  observations: string[];
  issues: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  recommendations: string[];
  growthStageEstimate: string;
  confidence: number;
  aiProvider: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatRequest {
  message: string;
  conversationHistory?: ChatMessage[];
  farmId?: string;
}

export interface ChatResponse {
  reply: string;
  suggestions: string[];
  confidence: number;
}

export interface AICapabilities {
  provider: string;
  model: string;
  features: Array<{
    name: string;
    endpoint: string;
    description: string;
  }>;
  supportedLanguages: string[];
  supportedCrops: string[];
  regions: string[];
}

export interface AIHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  provider: string;
  model?: string;
  lastChecked: string;
  details?: any;
  error?: string;
}

export interface TranslationRequest {
  text: string;
  targetLanguage: 'en' | 'rw';
}

export interface TranslationResponse {
  original: string;
  translated: string;
  targetLanguage: 'en' | 'rw';
}

/**
 * Get AI-powered agricultural advice
 */
export const getAgriculturalAdvice = async (
  request: AgriculturalAdviceRequest
): Promise<AgriculturalAdviceResponse> => {
  const response: AxiosResponse<ApiResponse<AgriculturalAdviceResponse>> = await apiClient.post('/ai/advice', request);
  return response.data.data;
};

/**
 * Analyze a crop/farm image for health assessment
 */
export const analyzeImage = async (
  request: ImageAnalysisRequest
): Promise<ImageAnalysisResponse> => {
  const response: AxiosResponse<ApiResponse<ImageAnalysisResponse>> = await apiClient.post('/ai/analyze-image', request);
  return response.data.data;
};

/**
 * Send a chat message to the AI assistant
 */
export const sendChatMessage = async (
  request: ChatRequest
): Promise<ChatResponse> => {
  const response: AxiosResponse<ApiResponse<ChatResponse>> = await apiClient.post('/ai/chat', request);
  return response.data.data;
};

/**
 * Get AI service capabilities
 */
export const getCapabilities = async (): Promise<AICapabilities> => {
  const response: AxiosResponse<ApiResponse<AICapabilities>> = await apiClient.get('/ai/capabilities');
  return response.data.data;
};

/**
 * Check AI service health status
 */
export const checkHealth = async (): Promise<AIHealthStatus> => {
  const response: AxiosResponse<ApiResponse<AIHealthStatus>> = await apiClient.get('/ai/health');
  return response.data.data;
};

/**
 * Translate text between English and Kinyarwanda
 */
export const translateText = async (
  request: TranslationRequest
): Promise<TranslationResponse> => {
  const response: AxiosResponse<ApiResponse<TranslationResponse>> = await apiClient.post('/ai/translate', request);
  return response.data.data;
};

/**
 * Create a chat session helper for managing conversation state
 */
export const createChatSession = () => {
  let conversationHistory: ChatMessage[] = [];

  return {
    /**
     * Send a message and get response
     */
    async sendMessage(message: string, farmId?: string): Promise<ChatResponse> {
      // Add user message to history
      conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });

      const response = await sendChatMessage({
        message,
        conversationHistory,
        farmId
      });

      // Add assistant response to history
      conversationHistory.push({
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString()
      });

      return response;
    },

    /**
     * Get conversation history
     */
    getHistory(): ChatMessage[] {
      return [...conversationHistory];
    },

    /**
     * Clear conversation history
     */
    clearHistory(): void {
      conversationHistory = [];
    },

    /**
     * Get last N messages
     */
    getLastMessages(n: number): ChatMessage[] {
      return conversationHistory.slice(-n);
    }
  };
};

// Export all functions as default object
const aiService = {
  getAgriculturalAdvice,
  analyzeImage,
  sendChatMessage,
  getCapabilities,
  checkHealth,
  translateText,
  createChatSession
};

export default aiService;
