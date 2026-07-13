// Supabase Auth "Send Email" hook (https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook).
// Supabase calls this function for every auth email instead of using its own
// mailer, so branded Resend templates are used for signup confirmation and
// password reset instead of the default Supabase-branded emails.
//
// Deploy: supabase functions deploy auth-send-email --no-verify-jwt
// Secrets: supabase secrets set RESEND_API_KEY=... SEND_EMAIL_HOOK_SECRET=...
// Then enable the hook in Authentication > Hooks > Send Email, pointing at
// this function's URL — Supabase generates SEND_EMAIL_HOOK_SECRET for you.

import { Webhook } from "npm:standardwebhooks@1"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
// Supabase's dashboard shows the secret as "v1,whsec_<base64>" — the
// verifier only wants the base64 part.
const HOOK_SECRET = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace("v1,whsec_", "")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const FROM_ADDRESS = "Granted AI <noreply@grantedai.app>"

interface EmailData {
  token: string
  token_hash: string
  redirect_to: string
  email_action_type: string
  site_url: string
  token_new: string
  token_hash_new: string
}

interface HookPayload {
  user: { email: string; new_email?: string }
  email_data: EmailData
}

// Only signup and password recovery are wired to a branded Resend template —
// those are the only auth emails this app currently sends (no magic link,
// invite, or email-change flows in the client). Anything else falls back to
// a minimal branded email built inline so it still sends instead of silently
// failing if one of those flows is ever added.
const TEMPLATE_BY_ACTION: Record<string, { alias: string; subject: string }> = {
  signup: { alias: "confirm-signup", subject: "Confirm your email for Granted AI" },
  recovery: { alias: "reset-password", subject: "Reset your Granted AI password" },
}

function buildConfirmationUrl(emailData: EmailData): string {
  const params = new URLSearchParams({
    token: emailData.token_hash,
    type: emailData.email_action_type,
    redirect_to: emailData.redirect_to,
  })
  return `${SUPABASE_URL}/auth/v1/verify?${params.toString()}`
}

function fallbackHtml(heading: string, body: string, confirmationUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:#F5F7FA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F5F7FA">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#FFFFFF;border:1px solid #E6E9EF;border-radius:12px;" bgcolor="#FFFFFF">
<tr>
<td style="padding:32px 32px 0 32px;text-align:left;">
<img src="https://www.grantedai.app/icon.png" alt="Granted AI" width="36" height="36" border="0" style="display:block;" />
</td>
</tr>
<tr>
<td style="padding:24px 32px 0 32px;">
<h1 style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:26px;color:#0C1B33;">${heading}</h1>
<p style="margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#56627A;">${body}</p>
</td>
</tr>
<tr>
<td style="padding:0 32px 32px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td bgcolor="#2186EB" style="border-radius:999px;">
<a href="${confirmationUrl}" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Continue</a>
</td>
</tr>
</table>
<p style="margin:24px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#8A94A6;">If the button doesn't work, copy and paste this link: ${confirmationUrl}</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`
}

async function sendViaTemplate(to: string, alias: string, subject: string, confirmationUrl: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      template: {
        id: alias,
        variables: { CONFIRMATION_URL: confirmationUrl },
      },
    }),
  })
  if (!res.ok) {
    throw new Error(`Resend template send failed (${res.status}): ${await res.text()}`)
  }
}

async function sendFallback(to: string, subject: string, heading: string, body: string, confirmationUrl: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html: fallbackHtml(heading, body, confirmationUrl),
    }),
  })
  if (!res.ok) {
    throw new Error(`Resend fallback send failed (${res.status}): ${await res.text()}`)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "not allowed" }, { status: 405 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  let user: HookPayload["user"]
  let emailData: EmailData
  try {
    const wh = new Webhook(HOOK_SECRET)
    const verified = wh.verify(payload, headers) as HookPayload
    user = verified.user
    emailData = verified.email_data
  } catch (error) {
    return Response.json(
      { error: { http_code: 401, message: `Invalid webhook signature: ${(error as Error).message}` } },
      { status: 401 },
    )
  }

  const confirmationUrl = buildConfirmationUrl(emailData)
  const mapped = TEMPLATE_BY_ACTION[emailData.email_action_type]

  try {
    if (mapped) {
      await sendViaTemplate(user.email, mapped.alias, mapped.subject, confirmationUrl)
    } else {
      // Unhandled action type (invite, magic link, email change, reauth) —
      // send a minimal branded email so the flow still works rather than
      // silently dropping it.
      await sendFallback(
        user.email,
        "Action required for your Granted AI account",
        "Confirm this request",
        "Use the link below to continue.",
        confirmationUrl,
      )
    }
  } catch (error) {
    return Response.json(
      { error: { http_code: 500, message: (error as Error).message } },
      { status: 500 },
    )
  }

  return Response.json({})
})
