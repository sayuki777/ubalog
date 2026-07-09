type ToastProps = {
  message: string;
  show: boolean;
};

export default function Toast({ message, show }: ToastProps) {
  if (!show) return null;

  return (
    <div className="fixed left-0 right-0 top-20 z-[60] px-4">
      <div className="mx-auto w-full max-w-[430px]">
        <div className="rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-bold text-white shadow-lg">
          {message}
        </div>
      </div>
    </div>
  );
}