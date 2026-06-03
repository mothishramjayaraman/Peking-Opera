import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = "service_bxkum9n";
const EMAILJS_TEMPLATE_ID = "template_n1w9xhe";
const EMAILJS_PUBLIC_KEY = "OhUYGwh4YvGDUhQn4";

export async function sendConfirmationEmail(userName, userEmail) {
  if (!userEmail) {
    console.warn("No email provided for confirmation message.");
    return;
  }

  try {
    const templateParams = {
      to_name: userName,
      to_email: userEmail,
      message: "Welcome to SingingAI! Your account has been successfully set up.",
    };

    const result = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    console.log("Email successfully sent!", result.status, result.text);
    return result;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}
