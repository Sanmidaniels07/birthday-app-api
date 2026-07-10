import { Router } from "express";
import { validate } from "../../middleware/error-handler.js";
import { signupSchema, verifyEmailSchema, resendOtpSchema, loginSchema } from "./auth.schemas.js";
import * as controller from "./auth.controller.js";
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter, otpLimiter } from '../../middleware/rate-limit.js';




export const authRouter = Router();


authRouter.post('/signup', authLimiter, validate({ body: signupSchema }), controller.signup);
authRouter.post('/verify-email', authLimiter, validate({ body: verifyEmailSchema }), controller.verifyEmail);
authRouter.post('/resend-otp', otpLimiter, validate({ body: resendOtpSchema }), controller.resendOtp);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', requireAuth, controller.me);