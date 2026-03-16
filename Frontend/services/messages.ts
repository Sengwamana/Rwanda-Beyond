import apiClient from './api';
import { ApiResponse, Message, MessageChannel, MessageStatus } from '../types';

const normalizeMessage = (item: any): Message => ({
  id: String(item?.id || item?._id || ''),
  userId: String(item?.userId || item?.user_id || ''),
  recommendationId: item?.recommendationId || item?.recommendation_id || undefined,
  channel: (item?.channel || 'sms') as MessageChannel,
  recipient: item?.recipient || '',
  subject: item?.subject || undefined,
  content: item?.content || '',
  contentRw: item?.contentRw || item?.content_rw || undefined,
  status: ((item?.readAt || item?.read_at) ? 'read' : (item?.status || 'queued')) as MessageStatus,
  externalMessageId: item?.externalMessageId || item?.external_message_id || undefined,
  sentAt:
    item?.sentAt
    || (typeof item?.sent_at === 'number' ? new Date(item.sent_at).toISOString() : item?.sent_at)
    || undefined,
  deliveredAt:
    item?.deliveredAt
    || (typeof item?.delivered_at === 'number' ? new Date(item.delivered_at).toISOString() : item?.delivered_at)
    || undefined,
  readAt:
    item?.readAt
    || (typeof item?.read_at === 'number' ? new Date(item.read_at).toISOString() : item?.read_at)
    || undefined,
  failedReason: item?.failedReason || item?.failed_reason || undefined,
  retryCount: item?.retryCount ?? item?.retry_count ?? 0,
  createdAt:
    item?.createdAt
    || (typeof item?.created_at === 'number' ? new Date(item.created_at).toISOString() : item?.created_at)
    || new Date().toISOString(),
});

export interface MessageQueryParams {
  page?: number;
  limit?: number;
  status?: MessageStatus;
  channel?: MessageChannel;
  unreadOnly?: boolean;
}

export interface MessageFeed {
  messages: Message[];
  unreadCount: number;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const messageService = {
  getMine: async (params?: MessageQueryParams): Promise<ApiResponse<MessageFeed>> => {
    const response = await apiClient.get<ApiResponse<any>>('/messages/me', { params });
    return {
      ...response.data,
      data: {
        ...response.data.data,
        messages: Array.isArray(response.data?.data?.messages)
          ? response.data.data.messages.map(normalizeMessage)
          : [],
      },
    };
  },

  markRead: async (id: string): Promise<ApiResponse<Message>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/messages/${id}/read`, {});
    return {
      ...response.data,
      data: normalizeMessage(response.data.data),
    };
  },

  markAllRead: async (): Promise<ApiResponse<{ updatedCount: number }>> => {
    const response = await apiClient.post<ApiResponse<{ updatedCount: number }>>('/messages/read-all', {});
    return response.data;
  },
};

export default messageService;
