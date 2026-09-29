type SupabaseDataError = {
  code?: string;
  message?: string;
  details?: string | null;
};

const workspaceTables = [
  "plan_catalog",
  "subscriptions",
  "search_history",
  "saved_solutions",
  "stripe_webhook_events",
];

const workspaceFunctions = [
  "reserve_search",
  "get_plan_usage",
  "complete_search",
  "fail_search",
];

export function isWorkspaceMigrationMissing(error: SupabaseDataError) {
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  if (error.code === "PGRST205") {
    return workspaceTables.some((tableName) => message.includes(tableName));
  }
  if (error.code === "PGRST202") {
    return workspaceFunctions.some((functionName) => message.includes(functionName));
  }
  if (error.code !== "42P01" && error.code !== "42883") {
    return false;
  }

  const workspaceObjects = [...workspaceTables, ...workspaceFunctions];
  return workspaceObjects.some((objectName) => message.includes(objectName));
}
