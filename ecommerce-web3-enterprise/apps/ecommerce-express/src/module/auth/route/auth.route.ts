// auth.route.ts => capa de ENRUTAMIENTO: mapea verbo HTTP + path -> Controller.
// Aquí NO hay lógica; solo se "cablean" middlewares (guards y rate limits) en el orden correcto.
import { Router } from "express";
import { authController } from "../controller/auth.controller";
import { jwtAuthGuard } from "../guard/auth.guard";
import { rateLimit } from "../../../shared/middleware/rate-limit.middleware";

// "Router()" => sub-aplicación de Express montada luego en app.ts bajo el prefijo "/api/v1/auth"
export const authRouter = Router();

// Límites anti fuerza bruta (Factory de middlewares): valores por IP y ventana de tiempo
// loginLimit: 10 intentos FALLIDOS por IP cada 15 min (un login correcto reinicia la cuenta: resetOnSuccess)
const loginLimit = rateLimit({ bucket: "auth-login", limit: 10, windowSeconds: 15 * 60, resetOnSuccess: true });
const sensitiveLimit = rateLimit({ bucket: "auth-sensitive", limit: 5, windowSeconds: 15 * 60 });

// --- Endpoints públicos (sin jwtAuthGuard: cualquiera puede llamarlos) ---

// POST /api/v1/auth/register => registrar nuevo usuario
authRouter.post("/register", sensitiveLimit, authController.registerUser);

// POST /api/v1/auth/login => iniciar sesión con email+password (o iniciar desafío 2FA)
authRouter.post("/login", loginLimit, authController.loginUser);

// POST /api/v1/auth/2fa/verify => segundo paso del login con 2FA
authRouter.post("/2fa/verify", loginLimit, authController.verifyTwoFactor);

// POST /api/v1/auth/oauth => canjear el token de Google/Facebook/Apple (obtenido por next-auth) por una sesión
authRouter.post("/oauth", loginLimit, authController.loginWithOAuth);

// POST /api/v1/auth/web3/nonce => pedir nonce SIWE; POST /api/v1/auth/web3 => iniciar sesión con la firma
authRouter.post("/web3/nonce", loginLimit, authController.createWeb3Nonce);
authRouter.post("/web3", loginLimit, authController.loginWithWeb3);

// POST /api/v1/auth/forgot-password => solicitar enlace de recuperación
authRouter.post("/forgot-password", sensitiveLimit, authController.requestPasswordReset);

// POST /api/v1/auth/reset-password => confirmar nueva contraseña con el token recibido por email
authRouter.post("/reset-password", sensitiveLimit, authController.resetPassword);

// POST /api/v1/auth/magic-link => pedir enlace mágico (RF-01.3); POST /magic-link/verify => canjearlo por la sesión
authRouter.post("/magic-link", sensitiveLimit, authController.requestMagicLink);
authRouter.post("/magic-link/verify", loginLimit, authController.loginWithMagicLink);

// POST /api/v1/auth/guest => RF-08.1 sesión de invitado para comprar sin crear contraseña
authRouter.post("/guest", sensitiveLimit, authController.guestCheckout);

// PATCH /api/v1/auth/user/:id/verify => confirmar verificación de email con el token
authRouter.patch("/user/:id/verify", sensitiveLimit, authController.verifyEmailToken);

// POST /api/v1/auth/verification/resend => reenviar el enlace de verificación
authRouter.post("/verification/resend", sensitiveLimit, authController.resendVerification);

// PATCH /api/v1/auth/sessions/:sessionId => renovar access token (requiere el refreshToken en el body)
authRouter.patch("/sessions/:sessionId", loginLimit, authController.refreshAccessToken);

// --- Endpoints protegidos (requieren jwtAuthGuard: Authorization: Bearer <accessToken>) ---

// DELETE /api/v1/auth/sessions/:sessionId => logout (revoca el refresh token de la sesión)
authRouter.delete("/sessions/:sessionId", jwtAuthGuard, authController.revokeSession);

// PATCH /api/v1/auth/2fa => activar/desactivar el segundo factor
authRouter.patch("/2fa", jwtAuthGuard, sensitiveLimit, authController.setTwoFactor);

// POST /api/v1/auth/web3/link => vincular wallet a la cuenta (nonce + firma, igual que el login SIWE)
authRouter.post("/web3/link", jwtAuthGuard, sensitiveLimit, authController.linkWallet);

// POST /api/v1/auth/phone/code => enviar código SMS; POST /phone/verify => confirmarlo (RF-01.1)
// "sensitiveLimit" => máximo 5 por IP cada 15 min: frena el abuso del envío de SMS (cuesta dinero)
authRouter.post("/phone/code", jwtAuthGuard, sensitiveLimit, authController.requestPhoneVerification);
authRouter.post("/phone/verify", jwtAuthGuard, loginLimit, authController.verifyPhone);
