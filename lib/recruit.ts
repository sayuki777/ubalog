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
    referralType: "url",
    buttonLabel: "Uber Eatsに登録する",
    description: "対応エリアが広く、初めての配達でも始めやすいサービスです。",
    point: "まずは自分の生活圏で注文が入りやすい時間帯を試してみましょう。",
  },
  {
    id: "rocketnow",
    name: "ロケットナウ",
    url: "https://rocketnowdriver.app.link/eYcxjFhF53b",
    referralType: "url",
    buttonLabel: "ロケットナウに登録する",
    description:
      "エリアによっては高単価案件が出ることもあります。ウバログの記録と相性が良いサービスです。",
    point: "対応エリアや案件の傾向を見ながら、無理のない範囲で試せます。",
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
    description:
      "都市部で使いやすいフードデリバリーサービスです。登録時に招待コードを入力してください。",
    point: "他サービスと併用する選択肢としても確認しやすいサービスです。",
    note: "登録時に招待コード「WZJ437」を入力してください。",
  },
  {
    id: "demae",
    name: "出前館",
    url: "https://service.demae-can.co.jp/gig_personal/",
    referralType: "none",
    buttonLabel: "出前館の公式登録ページを見る",
    description: "日本国内で知名度の高い配達サービスです。公式ページから登録できます。",
    point: "募集条件や対応エリアを確認して、自分に合うか見てみましょう。",
  },
];
