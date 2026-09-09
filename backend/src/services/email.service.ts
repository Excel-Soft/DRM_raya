import nodemailer from "nodemailer";

interface MailOptions {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

// Create a transporter using environment variables
// If variables are missing, it will log to console instead of sending (Development Mode)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.example.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || "user",
        pass: process.env.SMTP_PASS || "pass",
    },
});

const isConfigured =
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

export const emailService = {
    /**
     * Send an email.
     * In development (if SMTP not configured), logs the email content to console.
     */
    async sendEmail(options: MailOptions): Promise<boolean> {
        if (!isConfigured) {
            console.log("==========================================");
            console.log("[EMAIL SERVICE] SMTP not configured. Mocking email send.");
            console.log(`TO: ${options.to}`);
            console.log(`SUBJECT: ${options.subject}`);
            console.log(`TEXT: ${options.text}`);
            console.log("==========================================");
            return true;
        }

        try {
            const info = await transporter.sendMail({
                from: process.env.SMTP_FROM || '"WebExcels DRM" <noreply@example.com>',
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
            });

            console.log(`[EMAIL SERVICE] Message sent: ${info.messageId}`);
            return true;
        } catch (error) {
            console.error("[EMAIL SERVICE] Error sending email:", error);
            return false;
        }
    },

    async sendOtpEmail(to: string, otp: string): Promise<boolean> {
        const subject = "Password Reset OTP - WebExcels DRM";
        const text = `Your One-Time Password (OTP) for password reset is: ${otp}\n\nThis OTP is valid for 10 minutes. If you did not request this, please ignore this email.`;
        const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Use the code below to proceed:</p>
        <h1 style="color: #2563eb; letter-spacing: 2px;">${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `;

        return this.sendEmail({ to, subject, text, html });
    },
};
