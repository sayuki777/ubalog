type SaveButtonProps = {
  onClick: () => void;
  preview?: string;
  disabled?: boolean;
};

export default function SaveButton({ onClick, preview, disabled = false }: SaveButtonProps) {
  return (
    <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent px-4 pb-3 pt-3">
      <div className="mx-auto w-full max-w-[430px]">
        {preview && (
          <div className="mb-2 rounded-xl border border-green-100 bg-white/95 px-3 py-2 text-center text-xs font-bold text-green-800 shadow-sm">
            {preview}
          </div>
        )}
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="h-12 w-full rounded-xl bg-green-600 text-base font-bold text-white shadow-sm active:scale-[0.99] disabled:bg-green-300 disabled:active:scale-100"
        >
          {disabled ? "保存中..." : "保存する"}
        </button>
      </div>
    </div>
  );
}
