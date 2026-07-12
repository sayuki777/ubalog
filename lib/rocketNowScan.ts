export type RocketNowScanResult = {
  service: "ロケナウ";
  amount?: number;
  distanceKm?: number;
  shopName?: string;
  dropoffArea?: string;
  offerTags?: string[];
  orderCount?: number;
  missionCount?: number;
  missionBonusAmount?: number;
  includesBonus?: boolean;
  confidence?: number;
  rawText?: string;
};
