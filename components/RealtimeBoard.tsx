"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import Toast from "@/components/Toast";
import {
  analyzeRocketNowOfferImageWithOcr,
  type RocketNowOcrProgress,
} from "@/lib/rocketNowOcr";
import { type RocketNowScanResult } from "@/lib/rocketNowScan";
import { addBreakingRealtimeNews } from "@/lib/news";

const RealtimeMap = dynamic(() => import("@/components/RealtimeMap"), {
  ssr: false,
});

const STORAGE_KEY = "ubalog-realtime-offers";
const PROFILE_STORAGE_KEY = "ubalog-profile";
const ROCKETNOW_SCAN_FEEDBACK_STORAGE_KEY = "ubalog-rocketnow-scan-feedbacks";
const DEFAULT_CENTER: [number, number] = [35.681, 139.767];
const services = ["Uber", "出前館", "ロケナウ", "menu"] as const;
const timeFilters = [
  { label: "1h", hours: 1 },
  { label: "3h", hours: 3 },
  { label: "6h", hours: 6 },
  { label: "1日", hours: 24 },
  { label: "7日", hours: 168 },
];

type OfferRank = "S" | "A" | "B" | "C";
type InputSource = "manual" | "scan";
type ServiceName = (typeof services)[number];

type Profile = {
  displayName?: string;
  name?: string;
  nickname?: string;
  area?: string;
  mainService?: string;
  rankingName?: string;
};

type RealtimeOffer = {
  id: string;
  createdAt: string;
  name?: string;
  area: string;
  service: string;
  amount: number;
  distanceKm: number;
  unitPrice: number;
  rank: OfferRank;
  comment: string;
  shopName?: string;
  dropoffArea?: string;
  inputSource?: InputSource;
  offerTags?: string[];
  orderCount?: number;
  missionCount?: number;
  missionBonusAmount?: number;
  includesBonus?: boolean;
  scanService?: ServiceName;
  lat?: number;
  lng?: number;
};

type CurrentLocation = {
  lat: number;
  lng: number;
};

type PositionMode = "current" | "map";

type RocketNowFinalValues = {
  service: "ロケナウ";
  amount: number;
  distanceKm: number;
  shopName?: string;
  dropoffArea?: string;
  comment?: string;
};

type RocketNowScanFeedback = {
  id: string;
  createdAt: string;
  originalResult: RocketNowScanResult;
  finalValues: RocketNowFinalValues;
  changedFields: string[];
};

function loadOffers(): RealtimeOffer[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as RealtimeOffer[];
  } catch {
    return [];
  }
}

function saveOffers(offers: RealtimeOffer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(offers));
}

function loadRocketNowScanFeedbacks(): RocketNowScanFeedback[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(ROCKETNOW_SCAN_FEEDBACK_STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as RocketNowScanFeedback[];
  } catch {
    return [];
  }
}

function saveRocketNowScanFeedback(feedback: RocketNowScanFeedback) {
  const next = [feedback, ...loadRocketNowScanFeedbacks()].slice(0, 50);
  localStorage.setItem(ROCKETNOW_SCAN_FEEDBACK_STORAGE_KEY, JSON.stringify(next));
}

function loadProfile(): Profile | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

function displayNameFromProfile(profile: Profile | null) {
  const displayName = profile?.displayName?.trim();
  if (displayName) return displayName;

  const name = profile?.name?.trim();
  if (name) return name;

  const rankingName = profile?.rankingName?.trim();
  if (rankingName) return rankingName;

  const nickname = profile?.nickname?.trim();
  if (nickname) return nickname;

  return "匿名配達員";
}

function offerName(offer: RealtimeOffer) {
  return offer.name?.trim() || "匿名配達員";
}

function calculateUnitPrice(amount: number, distanceKm: number) {
  if (!distanceKm) return 0;
  return Math.floor(amount / distanceKm);
}

function judgeRank(unitPrice: number): OfferRank {
  if (unitPrice >= 500) return "S";
  if (unitPrice >= 350) return "A";
  if (unitPrice >= 250) return "B";
  return "C";
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roundCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

function hasLocation(offer: RealtimeOffer) {
  return typeof offer.lat === "number" && typeof offer.lng === "number";
}

function normalizeService(service: string) {
  return service === "Rocket" ? "ロケナウ" : service;
}

function rankClass(rank: OfferRank) {
  if (rank === "S") return "bg-green-100 text-green-700 border-green-200";
  if (rank === "A") return "bg-teal-100 text-teal-700 border-teal-200";
  if (rank === "B") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

function rankPanelClass(rank: OfferRank) {
  if (rank === "S") return "border-green-200 bg-green-50 text-green-800";
  if (rank === "A") return "border-teal-200 bg-teal-50 text-teal-800";
  if (rank === "B") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

function rankLabel(rank: OfferRank) {
  if (rank === "S") return "Sランク：神案件 🚀";
  if (rank === "A") return "Aランク：優秀案件 👍";
  if (rank === "B") return "Bランク：普通案件";
  return "Cランク：慎重に判断";
}

function trimValue(value?: string) {
  return value?.trim() ?? "";
}

function optionalNumber(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getRocketNowChangedFields(
  original: RocketNowScanResult,
  finalValues: RocketNowFinalValues
) {
  const changedFields: string[] = [];

  if (optionalNumber(original.amount) !== finalValues.amount) {
    changedFields.push("amount");
  }

  if (optionalNumber(original.distanceKm) !== finalValues.distanceKm) {
    changedFields.push("distanceKm");
  }

  if (trimValue(original.shopName) !== trimValue(finalValues.shopName)) {
    changedFields.push("shopName");
  }

  if (trimValue(original.dropoffArea) !== trimValue(finalValues.dropoffArea)) {
    changedFields.push("dropoffArea");
  }

  return changedFields;
}

function isWithinHours(iso: string, hours: number) {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= hours * 60 * 60 * 1000;
}

const SCAN_SERVICE_CONFIG: Record<
  ServiceName,
  {
    label: string;
    service: ServiceName;
    guideTitle: string;
    guideText: string;
    amountHint: string;
    distanceHint: string;
    shopHint: string;
    dropoffHint: string;
  }
> = {
  Uber: {
    label: "Uberスキャン",
    service: "Uber",
    guideTitle: "Uberのオファー画面を確認",
    guideText: "報酬と距離を中心に確認してください。店舗名や配達先方面は分かる範囲で入力できます。",
    amountHint: "例: 1372",
    distanceHint: "例: 3.4",
    shopHint: "店舗名が見える場合のみ入力",
    dropoffHint: "配達先方面が分かる場合のみ入力",
  },
  出前館: {
    label: "出前館スキャン",
    service: "出前館",
    guideTitle: "出前館のオファー画面を確認",
    guideText: "報酬、距離、店舗名を確認してください。配達先方面は分かる範囲で入力できます。",
    amountHint: "例: 980",
    distanceHint: "例: 2.8",
    shopHint: "店舗名が見える場合のみ入力",
    dropoffHint: "配達先方面が分かる場合のみ入力",
  },
  ロケナウ: {
    label: "ロケナウスキャン",
    service: "ロケナウ",
    guideTitle: "ロケナウのオファー画面を確認",
    guideText: "報酬、距離、店舗名、配達先方面を確認し、見える内容だけ入力してください。",
    amountHint: "例: 1200",
    distanceHint: "例: 3.0",
    shopHint: "店舗名が見える場合のみ入力",
    dropoffHint: "配達先方面が見える場合のみ入力",
  },
  menu: {
    label: "menuスキャン",
    service: "menu",
    guideTitle: "menuのオファー画面を確認",
    guideText: "報酬、距離、店舗名を確認してください。配達先方面は任意で入力できます。",
    amountHint: "例: 860",
    distanceHint: "例: 2.4",
    shopHint: "店舗名が見える場合のみ入力",
    dropoffHint: "配達先方面が分かる場合のみ入力",
  },
};
const ROCKETNOW_SCAN_CONFIG = {
  service: "ロケナウ" as const,
  label: "ロケナウスキャン",
  guideTitle: "ロケナウのオファー画面を確認",
  guideText: "報酬、距離、店舗名を確認して入力してください。",
  amountHint: "例: 2427",
  distanceHint: "例: 5.1",
  shopHint: "例: ウェンディーズ・ファーストキッチン 笹塚店",
  dropoffHint: "配達先方面が分かる場合のみ入力",
};

export default function RealtimeBoard() {
  const scanFileInputRef = useRef<HTMLInputElement | null>(null);
  const scanFileServiceRef = useRef<ServiceName>("ロケナウ");
  const [offers, setOffers] = useState<RealtimeOffer[]>([]);
  const [area, setArea] = useState("");
  const [service, setService] = useState<ServiceName>("Uber");
  const [amount, setAmount] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [comment, setComment] = useState("");
  const [shopName, setShopName] = useState("");
  const [dropoffArea, setDropoffArea] = useState("");
  const [inputSource, setInputSource] = useState<InputSource>("manual");
  const [selectedScanService, setSelectedScanService] = useState<ServiceName | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [pickedLocation, setPickedLocation] = useState<CurrentLocation | null>(null);
  const [positionMode, setPositionMode] = useState<PositionMode>("current");
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [selectedHours, setSelectedHours] = useState(24);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareInputOpen, setShareInputOpen] = useState(false);
  const [shareImageMessage, setShareImageMessage] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<RocketNowOcrProgress | null>(null);
  const [rocketNowScanResult, setRocketNowScanResult] =
    useState<RocketNowScanResult | null>(null);
  const [scanErrorMessage, setScanErrorMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("共有しました");
  const [showToast, setShowToast] = useState(false);

  const readCurrentLocation = useCallback(() => {
    return new Promise<CurrentLocation | null>((resolve) => {
      if (!navigator.geolocation) {
        setMapCenter(DEFAULT_CENTER);
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation = {
            lat: roundCoordinate(position.coords.latitude),
            lng: roundCoordinate(position.coords.longitude),
          };
          setCurrentLocation(nextLocation);
          setMapCenter([nextLocation.lat, nextLocation.lng]);
          resolve(nextLocation);
        },
        () => {
          setCurrentLocation(null);
          setMapCenter(DEFAULT_CENTER);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    });
  }, []);

  const requestLocation = useCallback(() => {
    void readCurrentLocation();
  }, [readCurrentLocation]);

  const showMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    window.setTimeout(() => {
      setShowToast(false);
    }, 1600);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loadedOffers = loadOffers().sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : -1
      );
      setOffers(loadedOffers);
      setSelectedOfferId(loadedOffers[0]?.id ?? null);
      requestLocation();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [requestLocation]);

  const amountNumber = parseInt(amount || "0", 10) || 0;
  const distanceNumber = parseFloat(distanceKm || "0") || 0;
  const unitPrice = useMemo(
    () => calculateUnitPrice(amountNumber, distanceNumber),
    [amountNumber, distanceNumber]
  );
  const rank = useMemo(() => judgeRank(unitPrice), [unitPrice]);
  const canSync = amountNumber >= 1 && distanceNumber > 0 && Boolean(service);
  const hasPickedMapLocation = positionMode !== "map" || Boolean(pickedLocation);
  const canSubmitOffer = canSync && hasPickedMapLocation;
  const sheetMissingMessage = !service
    ? "サービスを選択してください"
    : amountNumber < 1 || distanceNumber <= 0
    ? "報酬と距離を入力してください"
    : "";
  const syncMissingMessage = !service
    ? "サービスを選択してください"
    : amountNumber < 1
    ? "報酬金額を入力してください"
    : distanceNumber <= 0
    ? "距離を入力してください"
    : !hasPickedMapLocation
    ? "地図をタップして共有位置を指定してください"
    : "";

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      const normalized = normalizeService(offer.service);
      const knownService = services.includes(normalized as ServiceName);
      const inTime = isWithinHours(offer.createdAt, selectedHours);
      const serviceMatch = selectedService ? normalized === selectedService : true;
      return knownService && inTime && serviceMatch;
    });
  }, [offers, selectedHours, selectedService]);

  const locatedOffers = useMemo(
    () => filteredOffers.filter(hasLocation),
    [filteredOffers]
  );

  const selectedOffer = useMemo(
    () =>
      filteredOffers.find((offer) => offer.id === selectedOfferId) ??
      filteredOffers[0] ??
      null,
    [filteredOffers, selectedOfferId]
  );
  const currentScanConfig = selectedScanService
    ? selectedScanService === "ロケナウ"
      ? ROCKETNOW_SCAN_CONFIG
      : SCAN_SERVICE_CONFIG[selectedScanService]
    : null;
  const isRocketNowScan = inputSource === "scan" && selectedScanService === "ロケナウ";
  const rocketNowFinalValues = useMemo<RocketNowFinalValues | null>(() => {
    if (service !== "ロケナウ") return null;

    return {
      service: "ロケナウ",
      amount: amountNumber,
      distanceKm: distanceNumber,
      shopName: shopName.trim(),
      dropoffArea: dropoffArea.trim(),
      comment: comment.trim(),
    };
  }, [
    amountNumber,
    comment,
    distanceNumber,
    dropoffArea,
    service,
    shopName,
  ]);
  const rocketNowChangedFields = useMemo(() => {
    if (!rocketNowScanResult || !rocketNowFinalValues) return [];
    return getRocketNowChangedFields(rocketNowScanResult, rocketNowFinalValues);
  }, [rocketNowFinalValues, rocketNowScanResult]);

  const clearScanResult = () => {
    setRocketNowScanResult(null);
    setScanErrorMessage("");
    setOcrProgress(null);
  };

  const openShareSheet = () => {
    clearScanResult();
    setShareOpen(true);
  };

  const closeShareSheet = () => {
    clearScanResult();
    setShareOpen(false);
  };

  const startScanFlow = (item: ServiceName) => {
    setService(item);
    setSelectedScanService(item);
    setInputSource("scan");
    setShareInputOpen(true);
    setShareImageMessage("");
    clearScanResult();
    setScanLoading(false);
  };

  const startRocketNowScanFlow = () => {
    scanFileServiceRef.current = "ロケナウ";
    startScanFlow("ロケナウ");
    scanFileInputRef.current?.click();
  };

  const startManualFlow = () => {
    setShareImageMessage("");
    setSelectedScanService(null);
    setScanLoading(false);
    clearScanResult();
    setInputSource("manual");
    setShareInputOpen(true);
  };

  const handleImageSelect = (item: ServiceName, file: File | undefined) => {
    if (!file) return;

    setService(item);
    setSelectedScanService(item);
    setInputSource("scan");
    clearScanResult();
    setShopName("");
    setShareImageMessage("読み取り中...");
    setShareInputOpen(true);

    if (item === "ロケナウ") {
      void runRocketNowOcr(file);
    }
  };


  const runRocketNowOcr = async (file: File) => {
    if (scanLoading) return;

    setScanLoading(true);
    setShareImageMessage("読み取り中...");
    setOcrProgress({ message: "画像を調整中..." });
    setScanErrorMessage("");

    try {
      const result = await analyzeRocketNowOfferImageWithOcr(file, {
        onProgress: (progress) => {
          setOcrProgress(progress);
        },
      });
      setService(result.service);
      setAmount(result.amount ? String(result.amount) : "");
      setDistanceKm(result.distanceKm ? String(result.distanceKm) : "");
      setShopName("");
      setDropoffArea("");
      setRocketNowScanResult({
        ...result,
        shopName: "",
        dropoffArea: "",
      });
      setScanErrorMessage("");
      setShareImageMessage("読み取りました。内容を確認してください");
    } catch (error) {
      console.error("RocketNow OCR failed", error);
      setScanErrorMessage("読み取れませんでした。手入力してください");
      setOcrProgress(null);
      setShareImageMessage("");
    } finally {
      setOcrProgress(null);
      setScanLoading(false);
    }
  };

  const handleStartMapSync = () => {
    if (!canSync) return;

    setPositionMode("map");
    setShareOpen(false);
    setShareInputOpen(true);
    showMessage(
      pickedLocation
        ? "共有位置を指定しました"
        : "地図をタップして共有位置を指定してください"
    );
  };

  const handleSubmit = async () => {
    if (!canSync) return;
    if (positionMode === "map" && !pickedLocation) {
      showMessage("地図をタップして共有位置を指定してください");
      return;
    }

    let submitLocation: CurrentLocation | null = null;

    if (positionMode === "map") {
      submitLocation = pickedLocation;
    } else {
      submitLocation = currentLocation ?? (await readCurrentLocation());
    }

    const now = new Date().toISOString();
    const shouldSaveRocketNowFeedback =
      isRocketNowScan && rocketNowScanResult && rocketNowFinalValues;
    const newOffer: RealtimeOffer = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: now,
      name: displayNameFromProfile(loadProfile()),
      area: area.trim(),
      service,
      amount: amountNumber,
      distanceKm: distanceNumber,
      unitPrice,
      rank,
      comment: comment.trim(),
      shopName: shopName.trim(),
      dropoffArea: dropoffArea.trim(),
      inputSource,
      ...(inputSource === "scan" && selectedScanService
        ? { scanService: selectedScanService }
        : {}),
      ...(service === "ロケナウ"
        ? {}
        : {}),
      ...(submitLocation ? submitLocation : {}),
    };

    const next = [newOffer, ...offers].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1
    );
    saveOffers(next);
    addBreakingRealtimeNews({
      name: newOffer.name,
      amount: newOffer.amount,
      service: newOffer.service,
    });
    if (shouldSaveRocketNowFeedback) {
      saveRocketNowScanFeedback({
        id: `${now}-${Math.random().toString(36).slice(2)}`,
        createdAt: now,
        originalResult: rocketNowScanResult,
        finalValues: rocketNowFinalValues,
        changedFields: rocketNowChangedFields,
      });
    }
    setOffers(next);
    setSelectedOfferId(newOffer.id);

    setArea("");
    setService("Uber");
    setAmount("");
    setDistanceKm("");
    setComment("");
    setShopName("");
    setDropoffArea("");
    setInputSource("manual");
    setSelectedScanService(null);
    setPickedLocation(null);
    setPositionMode("current");
    setShareOpen(false);
    setShareInputOpen(false);
    setShareImageMessage("");
    clearScanResult();
    setScanLoading(false);
    showMessage("共有しました");
  };

  const handleDeleteOffer = (id: string) => {
    const next = offers.filter((offer) => offer.id !== id);
    saveOffers(next);
    setOffers(next);
    setSelectedOfferId((current) => (current === id ? next[0]?.id ?? null : current));
    showMessage("削除しました");
  };

  return (
    <main className="mx-auto h-[100dvh] w-full max-w-[430px] overflow-hidden bg-gray-50">
      <AppHeader title="リアルタイム共有" />
      <Toast message={toastMessage} show={showToast} />

      <section className="relative h-[calc(100dvh-8rem)] overflow-hidden bg-green-50">
        <RealtimeMap
          center={mapCenter}
          offers={locatedOffers}
          selectedOfferId={selectedOffer?.id ?? null}
          temporaryPin={pickedLocation}
          pickEnabled={positionMode === "map"}
          onSelectOffer={setSelectedOfferId}
          onMapClick={(point) => {
            const nextLocation = {
              lat: roundCoordinate(point.lat),
              lng: roundCoordinate(point.lng),
            };
            setPickedLocation(nextLocation);
            setPositionMode("map");
            setMapCenter([nextLocation.lat, nextLocation.lng]);
            showMessage("共有位置を指定しました");
          }}
        />

        <div className="pointer-events-none absolute left-3 top-3 rounded-2xl bg-white/95 px-3 py-2 shadow-sm">
          <div className="text-xs font-bold text-gray-500">表示中</div>
          <div className="text-sm font-bold text-gray-900">
            {filteredOffers.length}件・地図 {locatedOffers.length}件
          </div>
        </div>

        {!(positionMode === "map" && shareInputOpen && !shareOpen) && (
        <div className="absolute bottom-32 right-4 z-[560] flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={openShareSheet}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-green-600 text-center text-base font-bold leading-tight text-white shadow-2xl ring-4 ring-white active:scale-95"
          >
            ＋共有
          </button>
        </div>
        )}

        {positionMode === "map" && !shareOpen && (
          <div className="absolute left-4 right-20 top-24 z-[520] rounded-2xl bg-white/95 px-4 py-3 text-sm font-bold text-gray-800 shadow-lg">
            {pickedLocation
              ? "地図上で位置指定済み"
              : "地図をタップして共有位置を指定してください"}
          </div>
        )}

        {positionMode === "map" && shareInputOpen && !shareOpen && (
          <div className="absolute bottom-28 left-3 right-3 z-[560]">
            <ShareSyncFooter
              amountNumber={amountNumber}
              distanceNumber={distanceNumber}
              unitPrice={unitPrice}
              rank={rank}
              shopName={shopName}
              canSubmit={canSubmitOffer}
              missingMessage={syncMissingMessage}
              onSubmit={() => void handleSubmit()}
              onEdit={() => setShareOpen(true)}
              variant="map"
              service={service}
              actionLabel="共有する"
            />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-[500] bg-gradient-to-t from-white via-white to-white/80 px-3 pb-3 pt-3 shadow-[0_-10px_24px_rgba(0,0,0,0.08)]">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {timeFilters.map((item) => {
              const active = selectedHours === item.hours;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setSelectedHours(item.hours)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                    active ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setListOpen(true)}
              className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-bold text-green-700 ring-1 ring-green-200"
            >
              最近の共有
            </button>
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedService(null)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                selectedService === null ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              すべて
            </button>
            {services.map((item) => {
              const active = selectedService === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSelectedService(item)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                    active ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {listOpen && (
        <BottomSheet title="最近の共有" onClose={() => setListOpen(false)}>
          {filteredOffers.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-4 py-8 text-center text-sm font-bold text-gray-500">
              <div>まだ共有はありません</div>
              <div className="mt-1 text-xs">良い案件を見つけたら共有してみましょう</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOffers.map((offer) => (
                <OfferCard key={offer.id} offer={offer} onDelete={handleDeleteOffer} />
              ))}
            </div>
          )}
        </BottomSheet>
      )}

      {shareOpen && (
        <BottomSheet title="オファーを共有する" onClose={closeShareSheet}>
          <div className="space-y-3">
            <input
              ref={scanFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                handleImageSelect(scanFileServiceRef.current, event.target.files?.[0]);
                event.target.value = "";
              }}
            />

            {!shareInputOpen && (
              <>
                <div className="text-sm font-bold text-gray-800">画像から読み込む</div>
                <div className="grid grid-cols-2 gap-2">
                  {services.map((item) => {
                    const config = SCAN_SERVICE_CONFIG[item];
                    const isRocketNow = item === "ロケナウ";
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={
                          isRocketNow
                            ? startRocketNowScanFlow
                            : () => startScanFlow(item)
                        }
                        className="min-h-12 rounded-2xl border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-bold text-green-700 active:scale-[0.99]"
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-1 text-sm font-bold text-gray-800">手入力</div>
                <button
                  type="button"
                  onClick={startManualFlow}
                  className="h-12 w-full rounded-2xl bg-green-600 px-4 text-sm font-bold text-white shadow-sm active:scale-[0.99]"
                >
                  手入力
                </button>
              </>
            )}

            {shareInputOpen && (
              <div className="-mx-3 -mb-4">
              <div className="space-y-3 px-3 pb-36">
                {currentScanConfig && (
                  <div className="flex items-center justify-between rounded-2xl border border-green-100 bg-green-50 px-3 py-2">
                    <div className="text-sm font-bold text-green-800">{currentScanConfig.label}</div>
                    <button
                      type="button"
                      onClick={() => {
                        scanFileServiceRef.current = currentScanConfig.service;
                        scanFileInputRef.current?.click();
                      }}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-green-700 ring-1 ring-green-200 active:bg-green-50"
                    >
                      画像を選ぶ
                    </button>
                  </div>
                )}

                {inputSource === "scan" && currentScanConfig && (
                  <div className="rounded-2xl border border-green-100 bg-green-50 px-3 py-2">
                    <div className="text-xs font-bold text-green-700">
                      {scanErrorMessage ||
                        (scanLoading
                          ? ocrProgress?.message ?? "読み取り中..."
                          : shareImageMessage || "画像を選択してください")}
                    </div>
                    {scanLoading && typeof ocrProgress?.progress === "number" && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-green-100">
                        <div
                          className="h-full rounded-full bg-green-600 transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, ocrProgress.progress)
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {inputSource === "manual" && (
                  <Field label="サービス">
                    <select
                      value={service}
                      onChange={(e) => setService(e.target.value as ServiceName)}
                      className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    >
                      {services.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <div className="rounded-2xl border border-green-100 bg-green-50 p-3">
                  <div className="text-sm font-bold text-green-800">報酬金額</div>
                  <div className="mt-2 flex h-14 items-center rounded-2xl border border-green-200 bg-white px-3 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100">
                    <span className="mr-2 text-2xl font-bold text-gray-500">￥</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                      className="w-full border-none bg-transparent text-right text-3xl font-bold text-gray-900 outline-none"
                      placeholder={currentScanConfig?.amountHint ?? "例: 1000"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="text-sm font-bold text-gray-700">予定距離</div>
                    <div className="mt-2 flex h-12 items-center rounded-xl bg-gray-50 px-3 focus-within:ring-2 focus-within:ring-green-100">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(e.target.value.replace(/[^\d.]/g, ""))}
                        className="w-full border-none bg-transparent text-right text-2xl font-bold text-gray-900 outline-none"
                        placeholder={currentScanConfig?.distanceHint ?? "例: 3.0"}
                      />
                      <span className="ml-2 text-base font-bold text-gray-500">km</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="text-sm font-bold text-gray-700">距離単価</div>
                    <div className="mt-2 text-right text-2xl font-bold text-gray-900">
                      ￥{unitPrice.toLocaleString()}
                    </div>
                    <div className="text-right text-sm font-bold text-gray-500">/km</div>
                  </div>
                </div>

                <div className={`rounded-2xl border p-3 ${rankPanelClass(rank)}`}>
                  <div className="text-xs font-bold opacity-80">ランク判定</div>
                  <div className="mt-1 text-lg font-bold">{rankLabel(rank)}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="店舗名 任意">
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                      placeholder={currentScanConfig?.shopHint ?? "店舗名があれば入力"}
                    />
                  </Field>

                  <Field label="配達先方面 任意">
                    <input
                      type="text"
                      value={dropoffArea}
                      onChange={(e) => setDropoffArea(e.target.value)}
                      className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                      placeholder={currentScanConfig?.dropoffHint ?? "方面があれば入力"}
                    />
                  </Field>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-3">
                  <div className="text-sm font-bold text-gray-800">共有する位置</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPositionMode("current");
                        setPickedLocation(null);
                      }}
                      className={`rounded-xl px-3 py-3 text-sm font-bold ${
                        positionMode === "current"
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      現在地
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPositionMode("map");
                        setShareOpen(false);
                        showMessage("地図をタップして共有位置を指定してください");
                      }}
                      className={`rounded-xl px-3 py-3 text-sm font-bold ${
                        positionMode === "map"
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      地図にピン
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-xs font-bold text-gray-500">
                      {positionMode === "map"
                        ? pickedLocation
                          ? "地図上で位置指定済み"
                          : "地図をタップして共有位置を指定してください"
                        : currentLocation
                        ? "現在地を使用"
                        : "投稿時に現在地を確認します"}
                    </div>
                    {positionMode === "current" && (
                      <button
                        type="button"
                        onClick={requestLocation}
                        className="shrink-0 rounded-xl border border-green-200 px-3 py-2 text-xs font-bold text-green-700 active:bg-green-50"
                      >
                        現在地を確認
                      </button>
                    )}
                  </div>
                </div>

                <Field label="コメント 任意">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-20 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-base outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    placeholder="例: ピック早め、駅前は混雑"
                  />
                </Field>
              </div>
              <ShareSyncFooter
                amountNumber={amountNumber}
                distanceNumber={distanceNumber}
                unitPrice={unitPrice}
                rank={rank}
                shopName={shopName}
                canSubmit={canSync}
                missingMessage={sheetMissingMessage}
                onSubmit={handleStartMapSync}
                variant="sheet"
                service={service}
                actionLabel="地図に同期"
              />
              </div>
            )}
          </div>
        </BottomSheet>
      )}
      <BottomMenu />
    </main>
  );
}

function ShareSyncFooter({
  amountNumber,
  distanceNumber,
  unitPrice,
  rank,
  shopName,
  canSubmit,
  missingMessage,
  onSubmit,
  onEdit,
  variant,
  service,
  actionLabel,
}: {
  amountNumber: number;
  distanceNumber: number;
  unitPrice: number;
  rank: OfferRank;
  shopName: string;
  canSubmit: boolean;
  missingMessage: string;
  onSubmit: () => void;
  onEdit?: () => void;
  variant: "sheet" | "map";
  service: ServiceName;
  actionLabel: string;
}) {
  const trimmedShopName = shopName.trim();
  const hasPreview = amountNumber >= 1 && distanceNumber > 0;
  const footerClass =
    variant === "sheet"
      ? "sticky bottom-0 border-t border-gray-100 bg-white px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_24px_rgba(0,0,0,0.08)]"
      : "rounded-3xl border border-gray-100 bg-white/95 p-3 shadow-2xl";

  return (
    <div className={footerClass}>
      <div className="rounded-2xl border border-green-100 bg-green-50 px-3 py-2">
        {hasPreview ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-0.5 text-xs font-black text-green-700">
                  {service}
                </div>
                <div className="text-lg font-black text-gray-900">
                  ￥{amountNumber.toLocaleString()} / {distanceNumber.toLocaleString()}km
                </div>
                <div className="mt-0.5 text-sm font-bold text-green-700">
                  ￥{unitPrice.toLocaleString()}/km・{rank}ランク
                </div>
              </div>
            </div>
            {trimmedShopName && (
              <div className="mt-1 truncate text-xs font-bold text-gray-600">
                {trimmedShopName}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm font-bold text-gray-600">
            報酬と距離を入力するとプレビューします
          </div>
        )}
      </div>

      <div className={variant === "map" ? "mt-2 grid grid-cols-2 gap-2" : "mt-2"}>
        {variant === "map" && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="h-12 rounded-2xl border border-green-200 bg-white text-sm font-bold text-green-700 active:bg-green-50"
          >
            内容を変更
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="h-12 rounded-2xl bg-green-600 text-base font-bold text-white shadow-sm active:scale-[0.99] disabled:bg-gray-300"
        >
          {actionLabel}
        </button>
      </div>
      {!canSubmit && missingMessage && (
        <div className="mt-1 text-center text-xs font-bold text-gray-500">
          {missingMessage}
        </div>
      )}
    </div>
  );
}

function BottomSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[700] flex items-end justify-center bg-black/30">
      <div className="w-full max-w-[430px] rounded-t-3xl bg-white p-3 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-bold text-gray-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 px-3 py-1 text-sm font-bold text-gray-600"
          >
            閉じる
          </button>
        </div>
        <div className="max-h-[88dvh] overflow-y-auto pb-4">{children}</div>
      </div>
    </div>
  );
}

function OfferCard({
  offer,
  onDelete,
}: {
  offer: RealtimeOffer;
  onDelete: (id: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const trimmedArea = offer.area.trim();
  const trimmedShopName = offer.shopName?.trim();
  const trimmedDropoffArea = offer.dropoffArea?.trim();
  const trimmedComment = offer.comment.trim();

  return (
    <article className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-gray-900">{offerName(offer)}</div>
          <div className="mt-1 text-xs font-bold text-green-700">
            {normalizeService(offer.service)}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs font-bold text-gray-500">
          {formatTime(offer.createdAt)}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-green-100 bg-green-50 p-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-green-700">報酬</div>
            <div className="mt-1 text-2xl font-black text-gray-900">
              ￥{offer.amount.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-green-700">距離単価</div>
            <div className="mt-1 text-lg font-black text-green-700">
              ￥{offer.unitPrice.toLocaleString()}/km
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${rankClass(offer.rank)}`}
          >
            {offer.rank}ランク
          </span>
          <span className="text-sm font-bold text-gray-700">
            距離 {offer.distanceKm.toLocaleString()}km
          </span>
        </div>
      </div>

      <div className={`mt-3 rounded-xl border px-3 py-2 text-sm font-bold ${rankClass(offer.rank)}`}>
        {rankLabel(offer.rank)}
      </div>

      {(trimmedArea || trimmedShopName || trimmedDropoffArea) && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {trimmedArea && <DetailItem label="エリア" value={trimmedArea} />}
          {trimmedShopName && <DetailItem label="店舗名" value={trimmedShopName} />}
          {trimmedDropoffArea && <DetailItem label="配達先方面" value={trimmedDropoffArea} />}
        </div>
      )}

      {trimmedComment && (
        <div className="mt-3 rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-700">
          {trimmedComment}
        </div>
      )}

      {confirmingDelete ? (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-3">
          <div className="text-sm font-bold text-red-700">この共有を削除しますか？</div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="h-9 flex-1 rounded-xl bg-white text-sm font-bold text-gray-600 ring-1 ring-gray-200 active:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => onDelete(offer.id)}
              className="h-9 flex-1 rounded-xl bg-red-600 text-sm font-bold text-white active:bg-red-700"
            >
              削除
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 ring-1 ring-red-100 active:bg-red-100"
          >
            削除
          </button>
        </div>
      )}
    </article>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <div className="text-[11px] font-bold text-gray-500">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-gray-900">{value}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-800">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}


























