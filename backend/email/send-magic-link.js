const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

async function sendMagicLink(email, token) {
  const baseUrl = String(process.env.DASHBOARD_URL || '').replace(/\/$/, '')
  if (!baseUrl) throw new Error('DASHBOARD_URL is required to send dashboard magic links')
  const href = `${baseUrl}/?magic_link_token=${encodeURIComponent(token)}`
  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || 'Fluxera'}" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Your Fluxera sign-in link',
    text: `Use this one-time link to sign in to Fluxera. It expires in 15 minutes: ${href}`,
    html: `<p>Use this one-time link to sign in to Fluxera. It expires in 15 minutes.</p><p><a href="${href}">Sign in to Fluxera</a></p>`,
  })
}

module.exports = { sendMagicLink }
