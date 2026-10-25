"use server";
import { signIn } from "@/lib/auth-nextauth";
// [Server actions OAuth]: disparan signIn server-side con redirect al bridge | [Patrón]: Command | [Principio]: SRP | [Paradigma]: Funcional + async

// [Callback URL]: tras OAuth, Auth.js redirige a /api/auth/oauth/bridge → bridge intercambia id_token y setea cookies NestJS
const BRIDGE = "/api/auth/oauth/bridge";

export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: BRIDGE });
}
// [2026-10-24]: `signInWithMicrosoft` retirado → la pantalla solo ofrece Google (el proveedor sigue configurado en Auth.js por si se reactiva)
