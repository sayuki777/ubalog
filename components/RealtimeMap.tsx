"use client";

import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

type OfferRank = "S" | "A" | "B" | "C";

type MapOffer = {
  id: string;
  name?: string;
  area: string;
  service: string;
  amount: number;
  distanceKm: number;
  unitPrice: number;
  rank: OfferRank;
  comment?: string;
  shopName?: string;
  dropoffArea?: string;
  lat?: number;
  lng?: number;
};

type MapPoint = {
  lat: number;
  lng: number;
};

type RealtimeMapProps = {
  center: [number, number];
  offers: MapOffer[];
  selectedOfferId: string | null;
  temporaryPin: MapPoint | null;
  pickEnabled: boolean;
  onSelectOffer: (id: string) => void;
  onMapClick: (point: MapPoint) => void;
};

function rankColor(rank: OfferRank) {
  if (rank === "S") return "#16a34a";
  if (rank === "A") return "#0d9488";
  if (rank === "B") return "#d97706";
  return "#6b7280";
}

function rankBorderColor(rank: OfferRank) {
  if (rank === "S") return "#bbf7d0";
  if (rank === "A") return "#99f6e4";
  if (rank === "B") return "#fde68a";
  return "#e5e7eb";
}

function rankLabel(rank: OfferRank) {
  if (rank === "S") return "Sランク：神案件 🚀";
  if (rank === "A") return "Aランク：優秀案件 👍";
  if (rank === "B") return "Bランク：普通案件";
  return "Cランク：慎重に判断";
}

function formatPinAmount(amount: number) {
  if (amount >= 10000) return `¥${Math.floor(amount / 1000)}k`;
  if (amount >= 1000 && String(amount).length > 4) {
    return `¥${(amount / 1000).toFixed(1).replace(".0", "")}k`;
  }
  return `¥${amount}`;
}

function offerIcon(rank: OfferRank, amount: number, active: boolean) {
  const width = active ? 62 : 56;
  const height = active ? 34 : 30;
  const color = rankColor(rank);
  const borderColor = rank === "S" ? "#facc15" : rankBorderColor(rank);
  const label = formatPinAmount(amount);

  return L.divIcon({
    className: "",
    html: `<div style="min-width:${width}px;height:${height}px;border-radius:9999px;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;border:3px solid ${borderColor};box-shadow:0 8px 18px rgba(0,0,0,.25);padding:0 9px;white-space:nowrap;">${label}</div>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
  });
}

function currentLocationIcon() {
  return L.divIcon({
    className: "",
    html: '<div style="width:18px;height:18px;border-radius:9999px;background:#2563eb;border:4px solid white;box-shadow:0 0 0 6px rgba(37,99,235,.18);"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function temporaryPinIcon() {
  return L.divIcon({
    className: "",
    html: '<div style="width:38px;height:38px;border-radius:9999px;background:#16a34a;color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;border:4px solid white;box-shadow:0 10px 22px rgba(0,0,0,.28);">＋</div>',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
    window.setTimeout(() => map.invalidateSize(), 100);
  }, [center, map]);

  return null;
}

function ClickHandler({
  enabled,
  onMapClick,
}: {
  enabled: boolean;
  onMapClick: (point: MapPoint) => void;
}) {
  useMapEvents({
    click: (event) => {
      if (!enabled) return;
      onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
}

function normalizeService(service: string) {
  return service === "Rocket" ? "ロケナウ" : service;
}

function offerName(offer: MapOffer) {
  return offer.name?.trim() || "匿名配達員";
}

function rankBadgeClass(rank: OfferRank) {
  if (rank === "S") return "border-green-200 bg-green-100 text-green-700";
  if (rank === "A") return "border-teal-200 bg-teal-100 text-teal-700";
  if (rank === "B") return "border-amber-200 bg-amber-100 text-amber-700";
  return "border-gray-200 bg-gray-100 text-gray-600";
}

export default function RealtimeMap({
  center,
  offers,
  selectedOfferId,
  temporaryPin,
  pickEnabled,
  onSelectOffer,
  onMapClick,
}: RealtimeMapProps) {
  const locatedOffers = offers.filter(
    (offer) => typeof offer.lat === "number" && typeof offer.lng === "number"
  );

  return (
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl={false}
      className="h-full w-full"
    >
      <MapController center={center} />
      <ClickHandler enabled={pickEnabled} onMapClick={onMapClick} />
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <Marker position={center} icon={currentLocationIcon()} />

      {temporaryPin && (
        <Marker position={[temporaryPin.lat, temporaryPin.lng]} icon={temporaryPinIcon()}>
          <Popup>共有位置</Popup>
        </Marker>
      )}

      {locatedOffers.map((offer) => {
        const active = offer.id === selectedOfferId;
        const trimmedArea = offer.area.trim();
        const trimmedShopName = offer.shopName?.trim();
        const trimmedDropoffArea = offer.dropoffArea?.trim();
        const trimmedComment = offer.comment?.trim();

        return (
          <Marker
            key={offer.id}
            position={[offer.lat as number, offer.lng as number]}
            icon={offerIcon(offer.rank, offer.amount, active)}
            eventHandlers={{
              click: () => onSelectOffer(offer.id),
            }}
          >
            <Popup>
              <div className="min-w-40 text-sm text-gray-800">
                <div className="rounded-xl bg-green-50 px-3 py-2">
                  <div className="text-[11px] font-bold text-green-700">報酬</div>
                  <div className="text-2xl font-black text-gray-900">
                    ￥{offer.amount.toLocaleString()}
                  </div>
                  <div className="mt-1 text-base font-black text-green-700">
                    ￥{offer.unitPrice.toLocaleString()}/km
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full border px-2 py-1 text-xs font-bold ${rankBadgeClass(offer.rank)}`}
                  >
                    {rankLabel(offer.rank)}
                  </span>
                  <span className="text-xs font-bold text-gray-600">
                    {offer.distanceKm.toLocaleString()}km
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs font-bold text-gray-700">
                  <div>{normalizeService(offer.service)}</div>
                  <div>{offerName(offer)}</div>
                  {trimmedArea && <div>エリア: {trimmedArea}</div>}
                  {trimmedShopName && <div>店舗名: {trimmedShopName}</div>}
                  {trimmedDropoffArea && <div>配達先方面: {trimmedDropoffArea}</div>}
                  {trimmedComment && <div>コメント: {trimmedComment}</div>}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}






