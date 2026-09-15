import ar from "./dictionaries/ar.json";
import en from "./dictionaries/en.json";

export const dictionaries = { ar, en } as const;
export type Locale = keyof typeof dictionaries;

export function getDictionary(locale: Locale) {
  return dictionaries[locale] ?? dictionaries.ar;
}
