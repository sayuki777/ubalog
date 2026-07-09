type SalesRowProps = {
  company: string;
  amount: number;
  deliveries: number | "";
  onAmountChange: (value: number) => void;
  onDeliveriesChange: (value: number | "") => void;
};

export default function SalesRow({
  company,
  amount,
  deliveries,
  onAmountChange,
  onDeliveriesChange,
}: SalesRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-3">
      <div className="w-20 shrink-0 text-sm font-semibold text-gray-800">
        {company}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <div className="flex items-center rounded-lg border bg-white px-2 py-2">
          <span className="mr-1 text-sm text-gray-500">￥</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={amount === 0 ? "" : amount}
            onChange={(e) => onAmountChange(Number(e.target.value) || 0)}
            placeholder="0"
            className="w-20 border-none bg-transparent text-right text-sm outline-none"
          />
        </div>

        <div className="flex items-center rounded-lg border bg-white px-2 py-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={deliveries}
            onChange={(e) => {
              const raw = e.target.value;
              onDeliveriesChange(raw === "" ? "" : Number(raw));
            }}
            placeholder="0"
            className="w-12 border-none bg-transparent text-right text-sm outline-none"
          />
          <span className="ml-1 text-sm text-gray-500">件</span>
        </div>
      </div>
    </div>
  );
}