
export function verificationEmail(params: { name: string; code: string; ttlMinutes: number }) {
  const { name, code, ttlMinutes } = params;

  const subject = `${code} is your verification code`;

  const text = [
    `Hi ${name},`,
    ``,
    `Your verification code is: ${code}`,
    ``,
    `It expires in ${ttlMinutes} minutes. If you didn't create an account, ignore this email.`,
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#B9C4CC;font-family:Segoe UI,Arial,sans-serif;">
    <div style="max-width:480px;margin:40px auto;background:#F7F6F2;border-radius:16px;padding:32px;border:1px solid rgba(0,0,0,0.05);">
      <h1 style="margin:0 0 8px;font-size:20px;color:#232B2E;">🎂 Verify your email</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#4E6E7E;">Hi ${name}, use this code to finish signing up:</p>
      <div style="background:#2E3A3E;border-radius:12px;padding:20px;text-align:center;">
        <span style="font-family:Consolas,monospace;font-size:32px;letter-spacing:8px;color:#F7F6F2;">${code}</span>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#4E6E7E;">
        This code expires in ${ttlMinutes} minutes. Didn't create an account? You can safely ignore this.
      </p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}