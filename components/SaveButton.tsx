type SaveButtonProps = {
  onClick: () => void;
};

export default function SaveButton({ onClick }: SaveButtonProps) {
  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent px-4 pb-3 pt-3">
      <div className="mx-auto w-full max-w-[430px]">
        <button
          type="button"
          onClick={onClick}
          className="h-12 w-full rounded-xl bg-green-600 text-base font-bold text-white shadow-sm active:scale-[0.99]"
        >
          保存する
        </button>
      </div>
    </div>
  );
}