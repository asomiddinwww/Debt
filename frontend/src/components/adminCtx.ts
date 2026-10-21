"use client";

import { createContext, useContext } from "react";
import type { User } from "@/lib/types";

export const AdminCtx = createContext<{ user: User; logout: () => void } | null>(null);
export const useAdmin = () => useContext(AdminCtx)!;
