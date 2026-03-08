import apiClient from './api';
import { ApiResponse } from '../types';

export interface ResourceContentItem {
  id?: string;
  category: string;
  title: string;
  image?: string;
  desc: string;
  type?: 'article' | 'video' | string;
  date?: string;
  url?: string;
}

export interface FAQContentItem {
  id?: string;
  category: string;
  question: string;
  answer: string;
}

export interface CareerValueItem {
  id?: string;
  title: string;
  desc: string;
  icon?: 'heart' | 'zap' | 'users' | string;
}

export interface CareerPositionItem {
  id?: string;
  title: string;
  department?: string;
  location?: string;
  type?: string;
  desc: string;
}

export interface ResourcesContentPayload {
  items: ResourceContentItem[];
  categories: string[];
}

export interface FAQContentPayload {
  items: FAQContentItem[];
  categories: string[];
}

export interface CareersContentPayload {
  positions: CareerPositionItem[];
  values: CareerValueItem[];
  hero?: Record<string, string>;
}

export interface FeatureContentCard {
  id?: string;
  title: string;
  description: string;
  icon?: string;
}

export interface FeaturesContentPayload {
  hero?: {
    badge?: string;
    title?: string;
    subtitle?: string;
  };
  cards: FeatureContentCard[];
  highlights: string[];
  integrations: string[];
}

export interface PricingPlanItem {
  id?: string;
  name: string;
  price: string;
  period?: string;
  badge?: string;
  description?: string;
  cta?: string;
  featured?: boolean;
  features: string[];
}

export interface PricingContentPayload {
  hero?: {
    badge?: string;
    title?: string;
    subtitle?: string;
  };
  plans: PricingPlanItem[];
  footnote?: string;
}

export interface AboutValueItem {
  id?: string;
  title: string;
  description: string;
  icon?: string;
}

export interface AboutTeamMember {
  id?: string;
  name: string;
  role: string;
  image?: string;
}

export interface AboutContentPayload {
  hero?: {
    badge?: string;
    title?: string;
    subtitle?: string;
  };
  mission?: {
    title?: string;
    description?: string;
  };
  values: AboutValueItem[];
  team: AboutTeamMember[];
  cta?: {
    title?: string;
    button?: string;
  };
}

export const contentService = {
  getResources: async (): Promise<ApiResponse<ResourcesContentPayload>> => {
    const response = await apiClient.get<ApiResponse<ResourcesContentPayload>>('/content/resources');
    return response.data;
  },

  getFAQ: async (): Promise<ApiResponse<FAQContentPayload>> => {
    const response = await apiClient.get<ApiResponse<FAQContentPayload>>('/content/faq');
    return response.data;
  },

  getCareers: async (): Promise<ApiResponse<CareersContentPayload>> => {
    const response = await apiClient.get<ApiResponse<CareersContentPayload>>('/content/careers');
    return response.data;
  },

  getFeatures: async (): Promise<ApiResponse<FeaturesContentPayload>> => {
    const response = await apiClient.get<ApiResponse<FeaturesContentPayload>>('/content/features');
    return response.data;
  },

  getPricing: async (): Promise<ApiResponse<PricingContentPayload>> => {
    const response = await apiClient.get<ApiResponse<PricingContentPayload>>('/content/pricing');
    return response.data;
  },

  getAbout: async (): Promise<ApiResponse<AboutContentPayload>> => {
    const response = await apiClient.get<ApiResponse<AboutContentPayload>>('/content/about');
    return response.data;
  },

  submitCareerInterest: async (positionId: string | undefined, positionTitle: string): Promise<ApiResponse<{
    submitted: boolean;
    positionId: string | null;
    positionTitle: string;
  }>> => {
    const response = await apiClient.post<ApiResponse<{
      submitted: boolean;
      positionId: string | null;
      positionTitle: string;
    }>>('/content/careers/apply', { positionId, positionTitle });
    return response.data;
  },

  subscribeNewsletter: async (email: string): Promise<ApiResponse<{ subscribed: boolean; email: string }>> => {
    const response = await apiClient.post<ApiResponse<{ subscribed: boolean; email: string }>>(
      '/content/newsletter/subscribe',
      { email }
    );
    return response.data;
  },

  submitConsultation: async (payload: {
    name: string;
    size?: string;
    topic: string;
    message: string;
    language?: string;
  }): Promise<ApiResponse<{ submitted: boolean }>> => {
    const response = await apiClient.post<ApiResponse<{ submitted: boolean }>>('/content/consultations', payload);
    return response.data;
  },
};

export default contentService;
