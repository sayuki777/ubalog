export type PreprocessedImageResult = {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
};

function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("画像を変換できませんでした"));
      },
      type,
      0.92
    );
  });
}

export async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("画像を読み込めませんでした"));
    reader.readAsDataURL(file);
  });
}

export async function preprocessRocketNowImage(
  file: File
): Promise<PreprocessedImageResult> {
  try {
    const image = await readImage(file);
    const cropY = Math.floor(image.height * 0.42);
    const cropHeight = Math.max(1, Math.floor(image.height * 0.58));
    const scale = 1.7;
    const canvas = document.createElement("canvas");
    const width = Math.max(1, Math.floor(image.width * scale));
    const height = Math.max(1, Math.floor(cropHeight * scale));

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("画像を調整できませんでした");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      0,
      cropY,
      image.width,
      cropHeight,
      0,
      0,
      width,
      height
    );

    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    const contrast = 1.18;
    const brightness = 12;

    for (let index = 0; index < data.length; index += 4) {
      data[index] = Math.min(
        255,
        Math.max(0, (data[index] - 128) * contrast + 128 + brightness)
      );
      data[index + 1] = Math.min(
        255,
        Math.max(0, (data[index + 1] - 128) * contrast + 128 + brightness)
      );
      data[index + 2] = Math.min(
        255,
        Math.max(0, (data[index + 2] - 128) * contrast + 128 + brightness)
      );
    }

    context.putImageData(imageData, 0, 0);

    const blob = await canvasToBlob(canvas, "image/png");
    return {
      blob,
      dataUrl: canvas.toDataURL("image/png"),
      width,
      height,
    };
  } catch {
    return {
      blob: file,
      dataUrl: await fileToDataUrl(file),
      width: 0,
      height: 0,
    };
  }
}
