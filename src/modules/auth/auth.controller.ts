import type { Request, Response } from "express";
import * as authService from "./auth.service.js";
import { ok } from "../../utils/response.js";

import { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie } from "./auth.tokens.js";
import { noContent } from "../../utils/response.js";

export async function signup(req: Request, res: Response) {
  const result = await authService.signup(req.body);
  ok(
    res,
    {
      email: result.email,
      message: "We sent a 6-digit verification code to your email.",
      ...(result.otp ? { otp: result.otp } : {}),
    },
    undefined,
    202,
  );
}

export async function verifyEmail(req: Request, res: Response) {
  const result = await authService.verifyEmail(req.body);
  ok(res, result);
}

export async function resendOtp(req: Request, res: Response) {
  const result = await authService.resendOtp(req.body.email);
  ok(res, { email: result.email, message: "If that address needs a code, we sent one." });
}


const sessionMeta = (req: Request) => ({
  userAgent: req.headers["user-agent"],
  ip: req.ip,
});

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body, sessionMeta(req));
  setRefreshCookie(res, result.refreshToken);
  ok(res, { accessToken: result.accessToken, user: result.user });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return void res.status(401).json({
    error: { code: "UNAUTHORIZED", message: "No session" },
  });
  const result = await authService.refresh(token, sessionMeta(req));
  setRefreshCookie(res, result.refreshToken);
  ok(res, { accessToken: result.accessToken, user: result.user });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  noContent(res);
}

export async function me(req: Request, res: Response) {
  const user = await authService.getMe(req.user!.sub);
  ok(res, user);
}