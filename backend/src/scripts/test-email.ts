import { emailService } from "../server/email.service";

async function run() {
    console.log("Testing email service...");
    try {
        const success = await emailService.sendOtpEmail("test@example.com", "123456");
        console.log("Email send result:", success);
    } catch (error) {
        console.error("Email service error:", error);
    }
}

run();
