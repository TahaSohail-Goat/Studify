// Email sending via Brevo's HTTP API (https://www.brevo.com).
// We use the HTTP API (not SMTP) because cloud hosts like Railway's free tier
// block outbound SMTP/IPv6 — but plain HTTPS always works.
//
// Required env vars:
//   BREVO_API_KEY — your Brevo API key (starts with "xkeysib-")
//   EMAIL_USER    — the verified sender email (your Gmail you signed up to Brevo with)

export async function sendOtpEmail(toEmail, code) {
  const sender = process.env.EMAIL_USER;
  const apiKey = process.env.BREVO_API_KEY;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Studify", email: sender },
      to: [{ email: toEmail }],
      subject: "Your Studify verification code",
      htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#0e0906;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="480" cellpadding="0" cellspacing="0"
          style="background:#1a100a;border-radius:20px;border:1px solid rgba(201,164,122,0.2);
                 box-shadow:0 24px 64px rgba(0,0,0,0.5);">
          <tr>
            <td align="center" style="padding:36px 40px 24px;">
              <div style="display:inline-block;background:linear-gradient(135deg,#c9a47a,#ddbf9b);
                          border-radius:12px;padding:10px 14px;margin-bottom:18px;">
                <span style="font-size:22px;font-weight:800;color:#150d08;letter-spacing:-0.5px;">S</span>
              </div>
              <h1 style="margin:0;font-size:22px;font-weight:800;color:#f3eae0;
                         letter-spacing:-0.5px;">Verify your email</h1>
              <p style="margin:10px 0 0;font-size:14px;color:#b6a392;">
                Enter this code in Studify to complete your sign-up.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 40px 32px;">
              <div style="display:inline-block;background:rgba(201,164,122,0.1);
                          border:1px solid rgba(201,164,122,0.35);border-radius:16px;
                          padding:24px 40px;">
                <span style="font-size:40px;font-weight:800;letter-spacing:14px;
                             color:#f3eae0;font-family:monospace;">${code}</span>
              </div>
              <p style="margin:18px 0 0;font-size:13px;color:#b6a392;">
                This code expires in <strong style="color:#c9a47a;">10 minutes</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 32px;border-top:1px solid rgba(245,235,224,0.08);">
              <p style="margin:0;font-size:12px;color:#7a6a5e;text-align:center;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    }),
  });

  // Brevo returns a non-2xx status with a JSON error if something is wrong.
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (${res.status}): ${detail}`);
  }
}
