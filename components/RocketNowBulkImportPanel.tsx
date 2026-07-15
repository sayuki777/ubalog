"use client";

import { useEffect, useRef, useState } from "react";
import {
  readRocketNowBulkDailyFromImages,
  type RocketNowBulkDailyResult,
} from "@/lib/rocketNowDailyOcr";
import {
  readUbalogRecords,
  upsertRocketBulkRecords,
  type RocketBulkRecordProfile,
  type UbalogStoredRecord,
} from "@/lib/records";
import {
  saveRocketNowBulkImportHistory,
  type RocketNowBulkImportHistory,
} from "@/lib/rocketNowBulkImport";
import { saveBulkCorrectionFeedback } from "@/lib/rocketNowOcrFeedback";

const PANEL_OPEN_KEY = "ubalog-rocketnow-bulk-panel-open";

type Judge = "good" | "needs-check" | "amount-check" | "deliveries-check" | "date-check";

type BulkRow = RocketNowBulkDailyResult & {
  selected: boolean;
  amountInput: string;
  deliveriesInput: string;
  ocrAmount: number | null;
  ocrDeliveries: number | null;
};

type PendingImportItem = {
  row: BulkRow;
  amount: number;
  deliveries: number;
};

export default function RocketNowBulkImportPanel({
  selectedDate,
  profile,
  onCurrentDateImported,
  onSelectDate,
  launchToken,
}: {
  selectedDate: string;
  profile: RocketBulkRecordProfile;
  onCurrentDateImported: (value: { amount: number; deliveries: number }) => void;
  onSelectDate: (date: string) => void;
  launchToken?: number;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(PANEL_OPEN_KEY) === "true";
  });
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [message, setMessage] = useState("");
  const [importedSummary, setImportedSummary] = useState<
    Array<{ date: string; amount: number; deliveries: number }>
  >([]);
  const [confirming, setConfirming] = useState(false);

  const baseYear = Number(selectedDate.slice(0, 4)) || new Date().getFullYear();
  const records = typeof window === "undefined" ? [] : readUbalogRecords();
  const recordsByDate = new Map(records.map((record) => [record.date, record]));
  const pendingItems = getPendingItems(rows);
  const pendingTotalAmount = pendingItems.reduce((sum, item) => sum + item.amount, 0);
  const pendingTotalDeliveries = pendingItems.reduce(
    (sum, item) => sum + item.deliveries,
    0
  );
  const checkCount = rows.filter((row) => judgeRow(row) !== "good").length;
  const canStartConfirm = pendingItems.length > 0;

  const setPanelOpen = (value: boolean) => {
    setOpen(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(PANEL_OPEN_KEY, String(value));
    }
  };

  useEffect(() => {
    if (!launchToken) return;
    const timer = window.setTimeout(() => {
      setPanelOpen(true);
      fileInputRef.current?.click();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [launchToken]);

  const handleFiles = async (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []).filter((file) =>
      file.type.startsWith("image/")
    );
    if (selectedFiles.length === 0 || loading) return;

    setLoading(true);
    setMessage("");
    setRows([]);
    setImportedSummary([]);
    setConfirming(false);

    try {
      const results = await readRocketNowBulkDailyFromImages(selectedFiles, baseYear);
      setRows(
        results.map((result) => {
          const row: BulkRow = {
            ...result,
            selected: false,
            ocrAmount: result.amount,
            ocrDeliveries: result.deliveries,
            amountInput: typeof result.amount === "number" ? String(result.amount) : "",
            deliveriesInput:
              typeof result.deliveries === "number" ? String(result.deliveries) : "",
          };
          return { ...row, selected: judgeRow(row) === "good" };
        })
      );
      setMessage(
        results.length > 0
          ? `${results.length}日分を読み取りました`
          : "読み取れる日別データが見つかりませんでした"
      );
    } catch {
      setMessage("読み取れませんでした。スクショを変えて試してください");
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (id: string, updater: (row: BulkRow) => BulkRow) => {
    setConfirming(false);
    setRows((current) => current.map((row) => (row.id === id ? updater(row) : row)));
  };

  const handleConfirmImport = () => {
    if (!canStartConfirm) {
      setMessage("反映する日付を選んでください");
      return;
    }
    setConfirming(true);
    setMessage("");
  };

  const handleImport = () => {
    const now = new Date().toISOString();
    const beforeRecords = readUbalogRecords();
    const beforeByDate = new Map(beforeRecords.map((record) => [record.date, record]));

    const nextRecords = upsertRocketBulkRecords(
      pendingItems.map((item) => ({
        date: item.row.date,
        amount: item.amount,
        deliveries: item.deliveries,
      })),
      profile,
      now
    );
    const afterByDate = new Map(nextRecords.map((record) => [record.date, record]));

    const currentDateItem = pendingItems.find((item) => item.row.date === selectedDate);
    if (currentDateItem) {
      onCurrentDateImported({
        amount: currentDateItem.amount,
        deliveries: currentDateItem.deliveries,
      });
    }

    const entry: RocketNowBulkImportHistory = {
      id: `${now}-${Math.random().toString(36).slice(2)}`,
      createdAt: now,
      importedCount: pendingItems.length,
      totalAmount: pendingTotalAmount,
      totalDeliveries: pendingTotalDeliveries,
      items: pendingItems
        .map((item) => {
          const afterRecord = afterByDate.get(item.row.date);
          if (!afterRecord) return null;
          return {
            date: item.row.date,
            beforeRecord: beforeByDate.get(item.row.date) ?? null,
            afterRecord,
            importedRocketAmount: item.amount,
            importedRocketDeliveries: item.deliveries,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    };
    saveRocketNowBulkImportHistory(entry);
    saveBulkCorrectionFeedback({
      id: `${entry.id}-correction`,
      createdAt: now,
      type: "bulk",
      importHistoryId: entry.id,
      items: pendingItems.map((item) => ({
        date: item.row.date,
        matchedDateLabel: item.row.matchedDateLabel,
        ocrAmount: item.row.ocrAmount,
        ocrDeliveries: item.row.ocrDeliveries,
        correctedAmount: item.amount,
        correctedDeliveries: item.deliveries,
        baseAmount: item.row.baseAmount,
        adjustmentAmount: item.row.adjustmentAmount,
      })),
    });
    setImportedSummary(
      pendingItems.map((item) => ({
        date: item.row.date,
        amount: item.amount,
        deliveries: item.deliveries,
      }))
    );
    setConfirming(false);
    setMessage(`${pendingItems.length}日分を反映しました`);
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setPanelOpen(!open)}
        className="flex w-full min-w-0 items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <h2 className="text-base font-black text-gray-900">ロケナウ一気読み 🚀</h2>
          <p className="mt-1 text-xs font-bold leading-5 text-gray-600">
            スクショをまとめて、確認してからRocket欄へ反映できます。
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-xs font-black text-green-700">
          {open ? "閉じる" : "開く"}
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />

          <button
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="h-11 w-full rounded-xl bg-green-600 px-3 text-sm font-black text-white active:bg-green-700 disabled:bg-gray-300"
          >
            スクショをまとめて選ぶ
          </button>

          {(loading || message) && (
            <div className="mt-2 text-xs font-bold text-green-700">
              {loading ? "読み取り中..." : message}
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-3 space-y-2">
              <BulkSummary
                totalCount={rows.length}
                pendingCount={pendingItems.length}
                pendingTotalAmount={pendingTotalAmount}
                pendingTotalDeliveries={pendingTotalDeliveries}
                checkCount={checkCount}
              />
              <div className="grid grid-cols-3 gap-2">
                <SmallActionButton
                  label="全部ON"
                  onClick={() =>
                    setRows((current) =>
                      current.map((row) => ({ ...row, selected: true }))
                    )
                  }
                />
                <SmallActionButton
                  label="要確認OFF"
                  onClick={() =>
                    setRows((current) =>
                      current.map((row) => ({
                        ...row,
                        selected: judgeRow(row) === "good",
                      }))
                    )
                  }
                />
                <SmallActionButton
                  label="結果をクリア"
                  onClick={() => {
                    setRows([]);
                    setConfirming(false);
                    setImportedSummary([]);
                    setMessage("読み取り結果をクリアしました");
                  }}
                />
              </div>

              {rows.map((row) => (
                <BulkImportRow
                  key={row.id}
                  row={row}
                  existingRecord={recordsByDate.get(row.date)}
                  onChange={updateRow}
                />
              ))}

              {!confirming ? (
                <button
                  type="button"
                  disabled={!canStartConfirm}
                  onClick={handleConfirmImport}
                  className="h-11 w-full rounded-xl bg-gray-900 px-3 text-sm font-black text-white active:bg-black disabled:bg-gray-300"
                >
                  選んだ日付を反映
                </button>
              ) : (
                <ConfirmImportCard
                  items={pendingItems}
                  recordsByDate={recordsByDate}
                  totalAmount={pendingTotalAmount}
                  totalDeliveries={pendingTotalDeliveries}
                  onCancel={() => setConfirming(false)}
                  onImport={handleImport}
                />
              )}
            </div>
          )}

          {importedSummary.length > 0 && (
            <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-[11px] font-bold leading-5 text-green-800">
              <div>{importedSummary.length}日分を反映しました</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {importedSummary.slice(0, 3).map((item) => (
                  <button
                    key={item.date}
                    type="button"
                    onClick={() => onSelectDate(item.date)}
                    className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-green-700 ring-1 ring-green-100"
                  >
                    {formatShortDate(item.date)}を見る
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function getPendingItems(rows: BulkRow[]): PendingImportItem[] {
  return rows
    .filter((row) => row.selected)
    .map((row) => ({
      row,
      amount: Number(row.amountInput),
      deliveries: Number(row.deliveriesInput),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.amount) &&
        item.amount > 0 &&
        Number.isFinite(item.deliveries) &&
        item.deliveries >= 0
    );
}

function judgeRow(row: BulkRow): Judge {
  if (!row.date || !row.matchedDateLabel) return "date-check";

  const amount = Number(row.amountInput);
  const deliveries = Number(row.deliveriesInput);
  const hasAmount = row.amountInput.trim().length > 0 && Number.isFinite(amount);
  const hasDeliveries =
    row.deliveriesInput.trim().length > 0 && Number.isFinite(deliveries);

  if (hasAmount && !hasDeliveries) return "deliveries-check";
  if (!hasAmount && hasDeliveries) return "amount-check";
  if (!hasAmount && !hasDeliveries) return "needs-check";
  if (amount < 100 || amount > 100000 || deliveries <= 0 || deliveries > 100) {
    return "needs-check";
  }
  return "good";
}

function judgeLabel(judge: Judge) {
  if (judge === "good") return "いい感じ";
  if (judge === "amount-check") return "金額確認";
  if (judge === "deliveries-check") return "件数確認";
  if (judge === "date-check") return "日付確認";
  return "要確認";
}

function judgeClass(judge: Judge) {
  if (judge === "good") return "bg-green-100 text-green-700";
  return "bg-amber-100 text-amber-700";
}

function BulkSummary({
  totalCount,
  pendingCount,
  pendingTotalAmount,
  pendingTotalDeliveries,
  checkCount,
}: {
  totalCount: number;
  pendingCount: number;
  pendingTotalAmount: number;
  pendingTotalDeliveries: number;
  checkCount: number;
}) {
  return (
    <div className="rounded-xl bg-green-50 px-3 py-2">
      <div className="text-sm font-black text-green-900">読み取り結果</div>
      <div className="mt-1 text-xs font-bold text-green-800">
        {totalCount}日分見つかりました
      </div>
      <div className="mt-1 break-words text-[11px] font-bold leading-5 text-green-700">
        反映予定 {pendingCount}日 / 合計 {formatCurrency(pendingTotalAmount)} /{" "}
        {pendingTotalDeliveries}件 / 要確認 {checkCount}件
      </div>
    </div>
  );
}

function SmallActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 rounded-lg bg-gray-100 px-2 text-[11px] font-black text-gray-700 active:bg-gray-200"
    >
      {label}
    </button>
  );
}

function BulkImportRow({
  row,
  existingRecord,
  onChange,
}: {
  row: BulkRow;
  existingRecord?: UbalogStoredRecord;
  onChange: (id: string, updater: (row: BulkRow) => BulkRow) => void;
}) {
  const existingRocket = existingRecord?.services.rocket;
  const hasExistingRocket =
    Boolean(existingRocket) &&
    (existingRocket?.amount ?? 0) > 0 || (existingRocket?.deliveries ?? 0) > 0;
  const existingBadge = !existingRecord
    ? "新規追加"
    : hasExistingRocket
    ? "上書き予定"
    : "既存記録あり";
  const judge = judgeRow(row);

  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="text-sm font-black text-gray-900">
          {formatShortDate(row.date)}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${judgeClass(judge)}`}>
          {judgeLabel(judge)}
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-600 ring-1 ring-gray-200">
          {existingBadge}
        </span>
      </div>

      {hasExistingRocket && existingRocket && (
        <div className="mt-2 rounded-lg bg-white px-2 py-1.5 text-[11px] font-bold leading-5 text-gray-600">
          <div>
            既存: {formatCurrency(existingRocket.amount)} / {existingRocket.deliveries}件
          </div>
          <div>
            読取: {formatCurrency(Number(row.amountInput) || 0)} /{" "}
            {Number(row.deliveriesInput) || 0}件
          </div>
        </div>
      )}

      <div className="mt-2 grid grid-cols-[1fr_5.5rem] gap-2">
        <label className="min-w-0 text-[11px] font-bold text-gray-600">
          金額
          <div className="mt-1 flex h-10 min-w-0 items-center rounded-lg border border-gray-200 bg-white px-2 focus-within:border-green-500">
            <input
              type="text"
              inputMode="numeric"
              value={formatNumberInput(row.amountInput)}
              onChange={(event) =>
                onChange(row.id, (current) => ({
                  ...current,
                  amountInput: event.target.value.replace(/[^\d]/g, ""),
                }))
              }
              className="w-full min-w-0 border-none bg-transparent text-right text-sm font-bold text-gray-900 outline-none"
              placeholder="0"
            />
            <span className="ml-1 shrink-0 text-xs text-gray-500">円</span>
          </div>
        </label>
        <label className="min-w-0 text-[11px] font-bold text-gray-600">
          件数
          <div className="mt-1 flex h-10 min-w-0 items-center rounded-lg border border-gray-200 bg-white px-2 focus-within:border-green-500">
            <input
              type="text"
              inputMode="numeric"
              value={row.deliveriesInput}
              onChange={(event) =>
                onChange(row.id, (current) => ({
                  ...current,
                  deliveriesInput: event.target.value.replace(/[^\d]/g, ""),
                }))
              }
              className="w-full min-w-0 border-none bg-transparent text-right text-sm font-bold text-gray-900 outline-none"
              placeholder="0"
            />
            <span className="ml-1 shrink-0 text-xs text-gray-500">件</span>
          </div>
        </label>
      </div>

      <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {row.adjustmentAmount > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
              調整 +{formatCurrency(row.adjustmentAmount)}
            </span>
          )}
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-black text-gray-700">
          <input
            type="checkbox"
            checked={row.selected}
            onChange={(event) =>
              onChange(row.id, (current) => ({
                ...current,
                selected: event.target.checked,
              }))
            }
            className="h-4 w-4"
          />
          反映する
        </label>
      </div>
    </div>
  );
}

function ConfirmImportCard({
  items,
  recordsByDate,
  totalAmount,
  totalDeliveries,
  onCancel,
  onImport,
}: {
  items: PendingImportItem[];
  recordsByDate: Map<string, UbalogStoredRecord>;
  totalAmount: number;
  totalDeliveries: number;
  onCancel: () => void;
  onImport: () => void;
}) {
  return (
    <div className="rounded-xl border border-green-100 bg-green-50 p-3">
      <div className="text-sm font-black text-green-900">
        この内容で反映しますか？
      </div>
      <div className="mt-1 text-xs font-bold leading-5 text-green-800">
        <div>{items.length}日分</div>
        <div>合計 {formatCurrency(totalAmount)}</div>
        <div>配達 {totalDeliveries}件</div>
      </div>
      <div className="mt-2 space-y-1 text-[11px] font-bold text-green-800">
        <div>上書き予定:</div>
        {items.slice(0, 5).map((item) => {
          const existing = recordsByDate.get(item.row.date);
          const rocket = existing?.services.rocket;
          const hasExisting = rocket && (rocket.amount > 0 || rocket.deliveries > 0);
          return (
            <div key={item.row.id} className="break-words">
              {formatShortDate(item.row.date)}{" "}
              {hasExisting
                ? `Rocket ${formatCurrency(rocket.amount)} → ${formatCurrency(item.amount)}`
                : `新規追加 ${formatCurrency(item.amount)}`}
            </div>
          );
        })}
        {items.length > 5 && <div>ほか{items.length - 5}件</div>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onImport}
          className="h-10 rounded-xl bg-green-600 text-xs font-black text-white"
        >
          この内容で反映
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-xl bg-white text-xs font-black text-green-700 ring-1 ring-green-200"
        >
          戻って直す
        </button>
      </div>
    </div>
  );
}

function formatCurrency(amount: number) {
  return `￥${amount.toLocaleString()}`;
}

function formatNumberInput(value: string) {
  if (!value) return "";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : value;
}

function formatShortDate(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}
