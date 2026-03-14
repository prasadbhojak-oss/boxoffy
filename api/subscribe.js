// Vercel serverless function — /api/subscribe
// Receives { email, firstName, language } from the frontend
// Forwards to Resend Audiences API using the server-side API key
// API key never exposed to the browser

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, firstName, language } = req.body;

  // Basic validation
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email" });
  }
  if (!firstName || !firstName.trim()) {
    return res.status(400).json({ error: "First name required" });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_AUDIENCE_ID = "6fc2744e-1719-4693-91a9-770d9e0eea36";

  try {
    const resendRes = await fetch(
      `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          first_name: firstName.trim(),
          last_name: language || "All Languages",
          unsubscribed: false,
        }),
      }
    );

    if (resendRes.ok) {
      return res.status(200).json({ success: true });
    } else {
      const err = await resendRes.json();
      // Handle duplicate contact gracefully — still show success to user
      if (err.name === "validation_error" && err.message?.includes("already exists")) {
        return res.status(200).json({ success: true });
      }
      return res.status(500).json({ error: "Resend error", detail: err });
    }
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: e.message });
  }
}
