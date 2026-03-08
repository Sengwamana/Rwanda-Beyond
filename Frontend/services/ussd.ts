// =====================================================
// USSD Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { ApiResponse } from '../types';

export interface UssdCallbackRequest {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text?: string;
}

export interface UssdCallbackV2Request extends UssdCallbackRequest {
  networkCode?: string;
}

export interface UssdHealth {
  status: string;
  service: string;
  timestamp: string;
}

export const ussdService = {
  /**
   * USSD callback endpoint (Africa's Talking integration)
   */
  callback: async (payload: UssdCallbackRequest): Promise<string> => {
    const response = await apiClient.post<string>('/ussd/callback', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      responseType: 'text',
    });
    return response.data;
  },

  /**
   * Enhanced USSD callback endpoint with language/network support
   */
  callbackV2: async (payload: UssdCallbackV2Request): Promise<string> => {
    const response = await apiClient.post<string>('/ussd/callback/v2', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      responseType: 'text',
    });
    return response.data;
  },

  /**
   * Health check for USSD service
   */
  getHealth: async (): Promise<ApiResponse<UssdHealth> | UssdHealth> => {
    const response = await apiClient.get<ApiResponse<UssdHealth> | UssdHealth>('/ussd/health');
    return response.data;
  },
};

export default ussdService;
