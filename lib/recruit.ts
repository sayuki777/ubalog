export type RecruitService = {
  id: "uber" | "rocketnow" | "menu" | "demae";
  name: string;
  url: string;
  referralCode?: string;
  referralType?: "url" | "copy" | "none";
  buttonLabel: string;
  copyButtonLabel?: string;
  copiedLabel?: string;
  description: string;
  point: string;
  note?: string;
};

export const recruitServices: RecruitService[] = [
  {
    id: "uber",
    name: "Uber Eats",
    url: "https://www.uber.com/signup/drive/deliver/?invite_code=8yxjv31",
    referralCode: "8yxjv31",
    referralType: "url",
    buttonLabel: "Uber Eatsに登録する",
    description: "自由に始めやすい定番サービス",
    point: "はじめての配達にもおすすめです",
  },
  {
    id: "rocketnow",
    name: "ロケットナウ",
    url: "https://rocketnowdriver.app.link/eYcxjFhF53b",
    referralType: "url",
    buttonLabel: "ロケットナウに登録する",
    description: "新しい配達サービス",
    point: "キャンペーン時は選択肢に入りやすいです",
  },
  {
    id: "menu",
    name: "menu",
    url: "https://crew.menu.inc/",
    referralCode: "WZJ437",
    referralType: "copy",
    buttonLabel: "menuに登録する",
    copyButtonLabel: "招待コードをコピー",
    copiedLabel: "コピーしました",
    description: "サブ稼働にも使いやすいサービス",
    point: "他社と併用しやすい選択肢です",
    note: "登録時に招待コード「WZJ437」を入力してください",
  },
  {
    id: "demae",
    name: "出前館",
    url: "",
    referralType: "none",
    buttonLabel: "登録方法を見る",
    description: "報酬単価を重視したい人向け",
    point: "エリアや時期によって稼ぎやすさが変わります",
  },
];
