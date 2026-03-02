import nodemailer from "nodemailer";

export async function sendEmailWithAttachment(csvBuffer) {
    // If no HOST is provided, fallback to gmail
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SENDER_EMAIL,
            pass: process.env.SENDER_PASSWORD,
        },
    });

    const formattedDate = new Date().toISOString().split("T")[0];

    const mailOptions = {
        from: process.env.SENDER_EMAIL,
        to: "vivek.kumar@adventz.com",
        subject: `Zuari Stock Report Data - ${formattedDate}`,
        text: "Hello,\n\nPlease find the attached Zepto Zuari Stock Report containing stock and product details for the designated stores.\n\nBest regards,\nWeb Scraper Automator",
        attachments: [
            {
                filename: `Zuari_Stock_Report_${formattedDate}.csv`,
                content: csvBuffer,
            },
        ],
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
}
