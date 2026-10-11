export const FEATURE_UPDATE_PORTALS = ['player', 'admin', 'agent', 'team', 'scout', 'professional', 'auth', 'public-portal'] as const;
export type FeatureUpdatePortal = typeof FEATURE_UPDATE_PORTALS[number];

export interface FeatureUpdateMediaOptions {
  placement?: 'side' | 'banner';
  fit?: 'cover' | 'contain';
  aspectRatio?: number;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  poster?: string;
}

// Keep the delivery fields compatible with packages/features/src/featureUpdates.
export interface FeatureUpdateItem {
  key: string;
  name: string;
  description: string;
  releasedAt: string;
  badge?: string;
  highlights?: string[];
  media?: { type: 'image' | 'video'; src: string; alt: string; options?: FeatureUpdateMediaOptions };
  action?: { type: 'internal' | 'external'; label: string; href: string };
  enabled?: boolean;
}

export interface FeatureUpdateFields extends FeatureUpdateItem {
  belongs_to: FeatureUpdatePortal[];
  displayOrder: number;
}

export interface FeatureUpdatesConfig {
  appId: string;
  title: string;
  items: FeatureUpdateItem[];
}
