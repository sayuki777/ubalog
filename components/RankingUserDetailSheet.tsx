"use client";

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";
type RankingMetricKey = "sales" | "hourly" | "deliveries" | "unitPrice";

type RankingDetailRecord = {
  date: string;
  total: number;
  workMinutes?: number;
  services?: Partial<Record<ServiceKey, { amount?: number; deliveries?: number }>>;
};

export type RankingDetailEntry = {
  name: string;
  prefecture: string;
  area: string;
  total: number;
  workMinutes: number;
  deliveries: number;
  hourly: number;
  unitPrice: number;
  comment: string;
  records: RankingDetailRecord[];
};

function formatCurrency(amount: number) {
  return `¥${amount.toLocaleString()}`;
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatHourly(amount: number) {
  return amount > 0 ? `${formatCurrency(amount)}/h` : "-";
}

function formatUnitPrice(amount: number) {
  return amount > 0 ? formatCurrency(amount) : "-";
}

function mainMetricValue(entry: RankingDetailEntry, metric: RankingMetricKey) {
  if (metric === "hourly") return formatHourly(entry.hourly);
  if (metric === "deliveries") return `${entry.deliveries.toLocaleString()}件`;
  if (metric === "unitPrice") return `${formatCurrency(entry.unitPrice)}/km`;
  return formatCurrency(entry.total);
}

function metricCaption(metric: RankingMetricKey) {
  if (metric === "hourly") return "時給順";
  if (metric === "deliveries") return "件数順";
  if (metric === "unitPrice") return "単価順";
  return "売上順";
}

function serviceLabel(key: ServiceKey) {
  if (key === "uber") return "Uber";
  if (key === "demae") return "出前館";
  if (key === "menu") return "menu";
  if (key === "rocket") return "Rocket";
  return "その他";
}

function serviceTotals(records: RankingDetailRecord[]) {
  const totals = new Map<ServiceKey, { amount: number; deliveries: number }>();
  for (const record of records) {
    for (const key of Object.keys(record.services ?? {}) as ServiceKey[]) {
      const current = totals.get(key) ?? { amount: 0, deliveries: 0 };
      const service = record.services?.[key];
      totals.set(key, {
        amount: current.amount + (service?.amount ?? 0),
        deliveries: current.deliveries + (service?.deliveries ?? 0),
      });
    }
  }
  return [...totals.entries()]
    .map(([key, value]) => ({ key, label: serviceLabel(key), ...value }))
    .filter((service) => service.amount > 0 || service.deliveries > 0)
    .sort((a, b) => b.amount - a.amount || b.deliveries - a.deliveries);
}

function bestRecord(records: RankingDetailRecord[]) {
  return [...records].sort((a, b) => b.total - a.total)[0] ?? null;
}

function DetailItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <div className="text-[10px] font-bold text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm font-black text-gray-900">{value}</div>
    </div>
  );
}

export default function RankingUserDetailSheet({
  entry,
  rank,
  metric,
  period,
  region,
  onClose,
}: {
  entry: RankingDetailEntry;
  rank: number;
  metric: RankingMetricKey;
  period: string;
  region: string;
  onClose: () => void;
}) {
  const services = serviceTotals(entry.records);
  const mainService = services[0];
  const subServices = services.slice(1, 4);
  const best = bestRecord(entry.records);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 px-3 pb-3"
      onClick={onClose}
    >
      <div
        className="max-h-[82dvh] w-full max-w-[430px] overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-black text-green-700">
              {rank}位 / {period} / {region}
            </div>
            <div className="mt-1 truncate text-xl font-black text-gray-900">
              {entry.name}
            </div>
            <div className="mt-1 text-xs font-bold text-gray-500">
              {metricCaption(metric)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 shrink-0 rounded-full border border-gray-200 px-3 text-xs font-bold text-gray-600"
          >
            閉じる
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-green-50 px-4 py-3">
          <div className="text-xs font-bold text-green-700">メイン指標</div>
          <div className="mt-1 text-3xl font-black text-gray-900">
            {mainMetricValue(entry, metric)}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <DetailItem label="売上" value={formatCurrency(entry.total)} />
          <DetailItem label="時給" value={formatHourly(entry.hourly)} />
          <DetailItem label="件数" value={`${entry.deliveries.toLocaleString()}件`} />
          <DetailItem label="1件単価" value={formatUnitPrice(entry.unitPrice)} />
          <DetailItem label="稼働時間" value={formatMinutes(entry.workMinutes)} />
          <DetailItem label="記録日数" value={entry.records.length ? `${entry.records.length}日` : ""} />
          <DetailItem label="都道府県" value={entry.prefecture} />
          <DetailItem label="エリア" value={entry.area} />
          <DetailItem label="メインサービス" value={mainService?.label} />
          <DetailItem
            label="サブサービス"
            value={subServices.map((service) => service.label).join(" / ")}
          />
          <DetailItem
            label="最高売上日"
            value={best ? `${best.date.replaceAll("-", "/")} ${formatCurrency(best.total)}` : ""}
          />
        </div>

        {entry.comment.trim() && (
          <div className="mt-3 rounded-2xl bg-gray-50 px-3 py-3 text-sm font-bold text-gray-700">
            {entry.comment.trim()}
          </div>
        )}
      </div>
    </div>
  );
}
