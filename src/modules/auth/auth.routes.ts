import { Router } from "express";
import { validate } from "../../middleware/error-handler.js";
import { signupSchema, verifyEmailSchema, resendOtpSchema, loginSchema } from "./auth.schemas.js";
import * as controller from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/signup", validate({ body: signupSchema }), controller.signup);
authRouter.post("/verify-email", validate({ body: verifyEmailSchema }), controller.verifyEmail);
authRouter.post("/resend-otp", validate({ body: resendOtpSchema }), controller.resendOtp);
authRouter.post("/login", validate({ body: loginSchema }), controller.login);
authRouter.post("/refresh", controller.refresh);   
authRouter.post("/logout", controller.logout);