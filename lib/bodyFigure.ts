// Which body figure the muscle maps show. A display setting only, kept on this phone.
import type { BodySex } from "@/lib/bodyArt";

const KEY = "ags:body:figure";

export function loadBodyFigure(): BodySex {
  try {
    return localStorage.getItem(KEY) === "female" ? "female" : "male";
  } catch {
    return "male";
  }
}

export function saveBodyFigure(sex: BodySex) {
  try {
    localStorage.setItem(KEY, sex);
  } catch {
    // Storage unavailable: the choice lasts until the screen closes.
  }
}
