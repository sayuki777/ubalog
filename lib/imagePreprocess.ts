export type PreprocessedImageResult = {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  label: string;
};

type CropSpec = {
  label: string;
  topRatio: number;
  heightRatio: number;
  scale: number;
  grayscale?: boolean;
  contrast?: number;
  brightness?: number;
  threshold?: number;
};

const ROCKETNOW_DAILY_VARIANTS: CropSpec[] = [
  {
    label: "daily-full-gray",
    topRatio: 0,
    heightRatio: 1,
    scale: 2,
    grayscale: true,
    contrast: 1.34,
    brightness: 8,
  },
  {
    label: "daily-full-binary",
    topRatio: 0,
    heightRatio: 1,
    scale: 2.15,
    grayscale: true,
    contrast: 1.25,
    brightness: 12,
    threshold: 154,
  },
  {
    label: "daily-center-lower",
    topRatio: 0.08,
    heightRatio: 0.86,
    scale: 2,
    grayscale: true,
    contrast: 1.3,
    brightness: 8,
  },
  {
    label: "daily-light-gray-text",
    topRatio: 0.3,
    heightRatio: 0.48,
    scale: 3,
    grayscale: true,
    contrast: 1.12,
    brightness: -18,
    threshold: 220,
  },
  {
    label: "daily-list-light-gray-text",
    topRatio: 0.42,
    heightRatio: 0.34,
    scale: 3,
    grayscale: true,
    contrast: 1.08,
    brightness: -22,
    threshold: 230,
  },
];

const ROCKETNOW_VARIANTS: CropSpec[] = [
  {
    label: "bottom-55-contrast",
    topRatio: 0.45,
    heightRatio: 0.55,
    scale: 2.4,
    grayscale: true,
    contrast: 1.38,
    brightness: 10,
  },
  {
    label: "bottom-45-binary",
    topRatio: 0.55,
    heightRatio: 0.45,
    scale: 2.6,
    grayscale: true,
    contrast: 1.28,
    brightness: 14,
    threshold: 156,
  },
  {
    label: "full-contrast",
    topRatio: 0,
    heightRatio: 1,
    scale: 1.8,
    grayscale: true,
    contrast: 1.3,
    brightness: 8,
  },
];

function readImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
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
        reject(new Error("canvas conversion failed"));
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
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

function clampColor(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function applyImageAdjustments(canvas: HTMLCanvasElement, spec: CropSpec) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("canvas context unavailable");

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const contrast = spec.contrast ?? 1;
  const brightness = spec.brightness ?? 0;

  for (let index = 0; index < data.length; index += 4) {
    let red = data[index];
    let green = data[index + 1];
    let blue = data[index + 2];

    if (spec.grayscale) {
      const gray = red * 0.299 + green * 0.587 + blue * 0.114;
      red = gray;
      green = gray;
      blue = gray;
    }

    red = clampColor((red - 128) * contrast + 128 + brightness);
    green = clampColor((green - 128) * contrast + 128 + brightness);
    blue = clampColor((blue - 128) * contrast + 128 + brightness);

    if (typeof spec.threshold === "number") {
      const gray = red * 0.299 + green * 0.587 + blue * 0.114;
      const binary = gray >= spec.threshold ? 255 : 0;
      red = binary;
      green = binary;
      blue = binary;
    }

    data[index] = red;
    data[index + 1] = green;
    data[index + 2] = blue;
  }

  context.putImageData(imageData, 0, 0);
}

function renderVariant(image: HTMLImageElement, spec: CropSpec) {
  const cropY = Math.floor(image.height * spec.topRatio);
  const cropHeight = Math.max(
    1,
    Math.min(image.height - cropY, Math.floor(image.height * spec.heightRatio))
  );
  const maxWidth = 1800;
  const scaledWidth = Math.floor(image.width * spec.scale);
  const width = Math.max(1, Math.min(maxWidth, scaledWidth));
  const actualScale = width / image.width;
  const height = Math.max(1, Math.floor(cropHeight * actualScale));
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("canvas context unavailable");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, cropY, image.width, cropHeight, 0, 0, width, height);
  applyImageAdjustments(canvas, spec);

  return canvas;
}

async function canvasToResult(
  canvas: HTMLCanvasElement,
  label: string
): Promise<PreprocessedImageResult> {
  const blob = await canvasToBlob(canvas, "image/png");
  return {
    blob,
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
    label,
  };
}

export async function preprocessRocketNowImageVariants(
  file: File
): Promise<PreprocessedImageResult[]> {
  try {
    const image = await readImage(file);
    const results: PreprocessedImageResult[] = [];

    for (const spec of ROCKETNOW_VARIANTS) {
      const canvas = renderVariant(image, spec);
      results.push(await canvasToResult(canvas, spec.label));
    }

    return results;
  } catch {
    return [
      {
        blob: file,
        dataUrl: await fileToDataUrl(file),
        width: 0,
        height: 0,
        label: "original",
      },
    ];
  }
}


export async function preprocessRocketNowDailyImageVariants(
  file: Blob
): Promise<PreprocessedImageResult[]> {
  try {
    const image = await readImage(file);
    const results: PreprocessedImageResult[] = [];

    for (const spec of ROCKETNOW_DAILY_VARIANTS) {
      const canvas = renderVariant(image, spec);
      results.push(await canvasToResult(canvas, spec.label));
    }

    return results;
  } catch {
    return [
      {
        blob: file,
        dataUrl: await fileToDataUrl(file),
        width: 0,
        height: 0,
        label: "original",
      },
    ];
  }
}

export async function preprocessRocketNowImage(
  file: File
): Promise<PreprocessedImageResult> {
  const [first] = await preprocessRocketNowImageVariants(file);
  return first;
}
