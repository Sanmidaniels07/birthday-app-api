export function verificationEmail(params: {
  name: string;
  code: string;
  ttlMinutes: number;
}) {
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
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#B9C4CC;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#B9C4CC;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#F7F6F2;border-radius:20px;overflow:hidden;border:1px solid rgba(35,43,46,0.06);box-shadow:0 12px 40px rgba(35,43,46,0.08);">
            <!-- Accent bar -->
            <tr>
              <td style="height:4px;background:linear-gradient(90deg,#C4A574,#8A6410);"></td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 32px 28px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#8A6410;">
                  Birthday
                </p>
                <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:650;color:#232B2E;letter-spacing:-0.02em;">
                  Verify your email
                </h1>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.55;color:#4E6E7E;">
                  Hi ${name}, use the code below to finish signing up. It only takes a moment.
                </p>

                <!-- Code block -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="background:#2E3A3E;border-radius:14px;padding:22px 16px;">
                      <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(247,246,242,0.55);">
                        Your code
                      </p>
                      <p style="margin:0;font-family:Consolas,'SF Mono',Menlo,monospace;font-size:34px;font-weight:600;letter-spacing:10px;color:#F7F6F2;line-height:1;">
                        ${code}
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#4E6E7E;">
                  This code expires in <strong style="color:#232B2E;">${ttlMinutes} minutes</strong>.
                  If you didn’t create an account, you can safely ignore this email.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:0 32px 28px;">
                <div style="height:1px;background:rgba(35,43,46,0.08);margin-bottom:18px;"></div>
                <p style="margin:0;font-size:12px;line-height:1.45;color:#7A8F9A;text-align:center;">
                  Sent by Birthday · Please don’t reply to this email
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}