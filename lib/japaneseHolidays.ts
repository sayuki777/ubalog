const FIXED_HOLIDAYS: Record<string, string> = {
  "01-01": "元日",
  "02-11": "建国記念の日",
  "02-23": "天皇誕生日",
  "04-29": "昭和の日",
  "05-03": "憲法記念日",
  "05-04": "みどりの日",
  "05-05": "こどもの日",
  "08-11": "山の日",
  "11-03": "文化の日",
  "11-23": "勤労感謝の日",
};

function toDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function nthMonday(year: number, monthIndex: number, nth: number) {
  const first = new Date(year, monthIndex, 1);
  const diff = (8 - first.getDay()) % 7;
  return 1 + diff + (nth - 1) * 7;
}

export function isJapaneseHoliday(iso: string) {
  const date = toDate(iso);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const key = `${String(month + 1).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;

  if (FIXED_HOLIDAYS[key]) return true;
  if (month === 0 && day === nthMonday(year, 0, 2)) return true;
  if (month === 6 && day === nthMonday(year, 6, 3)) return true;
  if (month === 8 && day === nthMonday(year, 8, 3)) return true;
  if (month === 9 && day === nthMonday(year, 9, 2)) return true;

  return false;
}

export function isHolidayOrWeekend(iso: string) {
  const date = toDate(iso);
  const day = date.getDay();
  return day === 0 || day === 6 || isJapaneseHoliday(iso);
}
