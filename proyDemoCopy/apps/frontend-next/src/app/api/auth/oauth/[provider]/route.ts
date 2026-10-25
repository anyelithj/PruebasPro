import { NextResponse } from "next/server";

const SUPPORTED = new Set(["google", "outlook", "apple"]);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;
  if (!SUPPORTED.has(provider)) {
    return NextResponse.json({ message: `Provider '${provider}' no soportado` }, { status: 404 });
  }
  const envKey = `${provider.toUpperCase()}_CLIENT_ID`;
  if (!process.env[envKey]) {
    const url = new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7000");
    url.searchParams.set(
      "oauth_error",
      `${provider}: configurar ${envKey} en .env del backend`,
    );
    return NextResponse.redirect(url);
  }
  return NextResponse.json(
    {
      message: `OAuth ${provider} pendiente de implementar en backend`,
      todo: [
        `POST /api/v1/auth/oauth/${provider}/start (NestJS) — redirect a provider`,
        `GET /api/v1/auth/oauth/${provider}/callback — intercambia code → JWT`,
        "Setear cookies httpOnly como en /auth/login",
      ],
    },
    { status: 501 },
  );
}
