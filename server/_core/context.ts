import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: any // Use any to allow manual context creation without express options
): Promise<TrpcContext> {
  // Hardcoded for single-user isolation as requested
  const user: User = {
    id: 1,
    openId: "omni-boss",
    name: "Boss",
    email: "boss@omni.ai",
    loginMethod: "hardcoded",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    req: opts?.req,
    res: opts?.res,
    user,
  };
}
