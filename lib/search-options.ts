export type SearchCategory =
  | "freelancing"
  | "business"
  | "student"
  | "tech";

export const searchCategories: SearchCategory[] = [
  "freelancing",
  "business",
  "student",
  "tech",
];

const searchCategorySet: ReadonlySet<string> = new Set(searchCategories);

export function isSearchCategory(value: unknown): value is SearchCategory {
  return typeof value === "string" && searchCategorySet.has(value);
}
