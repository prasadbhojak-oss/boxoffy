// Vercel Serverless Function — /api/contact
// Uses Resend API. Set RESEND_API_KEY in Vercel environment variables.
// Recipient: info@boxoffy.com

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, phone, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!email.includes("@")) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not set");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Boxoffy Contact <contact@boxoffy.com>",
        to:   ["info@boxoffy.com"],
        reply_to: email,
        subject: `Boxoffy Contact: ${name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; padding: 24px;">
            <h2 style="color: #EF4444; margin-bottom: 4px;">New Contact Form Submission</h2>
            <p style="color: #6B7280; font-size: 13px; margin-top: 0;">via boxoffy.com</p>
            <hr style="border: 1px solid #E5E7EB; margin: 16px 0;" />
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: 700; color: #111827; width: 120px;">Name</td>
                <td style="padding: 8px 0; color: #374151;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 700; color: #111827;">Email</td>
                <td style="padding: 8px 0; color: #374151;"><a href="mailto:${email}">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 700; color: #111827;">Phone</td>
                <td style="padding: 8px 0; color: #374151;">${phone || "Not provided"}</td>
              </tr>
            </table>
            <hr style="border: 1px solid #E5E7EB; margin: 16px 0;" />
            <p style="font-weight: 700; color: #111827; margin-bottom: 8px;">Message</p>
            <div style="background: #F9FAFB; border-left: 3px solid #EF4444; padding: 16px; color: #374151; line-height: 1.6;">
              ${message.replace(/\n/g, "<br/>")}
            </div>
            <p style="font-size: 11px; color: #9CA3AF; margin-top: 24px;">Sent from boxoffy.com contact form</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Resend error:", err);
      return res.status(500).json({ error: "Failed to send email" });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Contact handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
