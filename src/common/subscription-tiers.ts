// Subscription tiers & feature flags (Phase M) — from the "ZONIC Tariflar" doc.
// Free / Gold / Gold+. Prices in UZS per month. Features drive client gating; the backend exposes
// them and (where relevant) can enforce them.

export type Tier = 'free' | 'gold' | 'gold_plus';

export interface TierFeatures {
  noAds: boolean;
  verifiedBadge: boolean;
  mapColors: boolean; // custom neon territory colors
  avatarOnTerritory: boolean; // selfie shown on owned territory
  canCreateClan: boolean;
  canCreateChallenge: boolean;
  aiCoach: boolean;
  storiesPerDay: number; // -1 = unlimited
  imagesPerPost: number;
}

export interface TierPlan {
  tier: Tier;
  title: string;
  pricePerMonthUzs: number;
  features: TierFeatures;
}

export const TIER_PLANS: Record<Tier, TierPlan> = {
  free: {
    tier: 'free',
    title: 'Starter',
    pricePerMonthUzs: 0,
    features: {
      noAds: false,
      verifiedBadge: false,
      mapColors: false,
      avatarOnTerritory: false,
      canCreateClan: false,
      canCreateChallenge: false,
      aiCoach: false,
      storiesPerDay: 0,
      imagesPerPost: 1,
    },
  },
  gold: {
    tier: 'gold',
    title: 'Gold',
    pricePerMonthUzs: 15000,
    features: {
      noAds: true,
      verifiedBadge: true,
      mapColors: true,
      avatarOnTerritory: true,
      canCreateClan: false,
      canCreateChallenge: false,
      aiCoach: false,
      storiesPerDay: 1,
      imagesPerPost: 5,
    },
  },
  gold_plus: {
    tier: 'gold_plus',
    title: 'Gold+',
    pricePerMonthUzs: 30000,
    features: {
      noAds: true,
      verifiedBadge: true,
      mapColors: true,
      avatarOnTerritory: true,
      canCreateClan: true,
      canCreateChallenge: true,
      aiCoach: true,
      storiesPerDay: -1,
      imagesPerPost: 10,
    },
  },
};

export const isTier = (v: string): v is Tier => v === 'free' || v === 'gold' || v === 'gold_plus';
