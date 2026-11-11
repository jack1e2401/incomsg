import { createContext, useContext, type ReactNode } from "react";
import { createMockApi } from "./mock";
import type { CommerceApi } from "./types";

const api = createMockApi();
const ApiContext = createContext<CommerceApi>(api);
export function ApiProvider({ children }: { children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}
export const useApi = () => useContext(ApiContext);
