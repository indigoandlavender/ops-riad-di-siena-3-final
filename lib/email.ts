import { Resend } from "resend";

// Lazy initialization to avoid build-time errors
let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Admin email for notifications
const ADMIN_EMAIL = "happy@riaddisiena.com";
const FROM_EMAIL = "Riad di Siena <noreply@riaddisiena.com>";

interface BookingEmailData {
  bookingId: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  room?: string;
  property?: string;
  amount?: number;
  paymentType: "city_tax" | "booking";
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Send notification to admin when payment is received
export async function sendAdminPaymentNotification(data: BookingEmailData): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY");
    return { success: false, error: "Email service not configured" };
  }

  const paymentTypeLabel = data.paymentType === "city_tax" ? "City Tax" : "Booking";
  const amountStr = data.amount ? `€${data.amount.toFixed(2)}` : "N/A";

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `Payment Received: ${paymentTypeLabel} - ${data.guestName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 20px;">Payment Confirmation</h2>

          <div style="background: #f8f5f0; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Payment Type</p>
            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 18px; font-weight: 600;">${paymentTypeLabel}</p>

            <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Amount</p>
            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 700;">${amountStr}</p>

            <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Guest</p>
            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px;">${data.guestName}</p>

            <div style="display: flex; gap: 40px;">
              <div>
                <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Check-In</p>
                <p style="margin: 0; color: #1a1a1a; font-size: 14px;">${formatDate(data.checkIn)}</p>
              </div>
              <div>
                <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Check-Out</p>
                <p style="margin: 0; color: #1a1a1a; font-size: 14px;">${formatDate(data.checkOut)}</p>
              </div>
            </div>
          </div>

          <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 20px;">
            <p style="margin: 0 0 12px 0; color: #666; font-size: 13px;"><strong>Booking ID:</strong> ${data.bookingId}</p>
            <p style="margin: 0 0 12px 0; color: #666; font-size: 13px;"><strong>Nights:</strong> ${data.nights}</p>
            <p style="margin: 0 0 12px 0; color: #666; font-size: 13px;"><strong>Guests:</strong> ${data.guests}</p>
            ${data.room ? `<p style="margin: 0 0 12px 0; color: #666; font-size: 13px;"><strong>Room:</strong> ${data.room}</p>` : ""}
            ${data.guestEmail ? `<p style="margin: 0; color: #666; font-size: 13px;"><strong>Email:</strong> ${data.guestEmail}</p>` : ""}
          </div>

          <p style="margin-top: 24px; color: #999; font-size: 12px; text-align: center;">
            This is an automated notification from Riad di Siena Ops
          </p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send admin notification:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Send confirmation email to guest
export async function sendGuestPaymentConfirmation(data: BookingEmailData): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY");
    return { success: false, error: "Email service not configured" };
  }

  if (!data.guestEmail) {
    console.error("No guest email provided");
    return { success: false, error: "No guest email" };
  }

  const paymentTypeLabel = data.paymentType === "city_tax" ? "City Tax" : "Booking";
  const amountStr = data.amount ? `€${data.amount.toFixed(2)}` : "";

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: data.guestEmail,
      subject: `Payment Confirmed - Riad di Siena`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-family: Georgia, serif; color: #1a1a1a; font-size: 28px; font-weight: normal; margin: 0;">Riad di Siena</h1>
          </div>

          <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <div style="width: 48px; height: 48px; background: #dcfce7; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
              <span style="color: #16a34a; font-size: 24px;">✓</span>
            </div>
            <h2 style="color: #166534; margin: 0 0 8px 0; font-size: 20px;">Payment Received</h2>
            <p style="color: #15803d; margin: 0; font-size: 14px;">Thank you for your ${paymentTypeLabel.toLowerCase()} payment${amountStr ? ` of ${amountStr}` : ""}.</p>
          </div>

          <div style="background: #f8f5f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px;">Your Stay Details</h3>

            <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Guest</p>
            <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px;">${data.guestName}</p>

            <div style="display: flex; gap: 40px; margin-bottom: 16px;">
              <div>
                <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Check-In</p>
                <p style="margin: 0; color: #1a1a1a; font-size: 14px;">${formatDate(data.checkIn)}</p>
              </div>
              <div>
                <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Check-Out</p>
                <p style="margin: 0; color: #1a1a1a; font-size: 14px;">${formatDate(data.checkOut)}</p>
              </div>
            </div>

            <p style="margin: 0 0 4px 0; color: #666; font-size: 13px;"><strong>Nights:</strong> ${data.nights}</p>
            <p style="margin: 0; color: #666; font-size: 13px;"><strong>Guests:</strong> ${data.guests}</p>
          </div>

          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            If you have any questions about your reservation, please don't hesitate to contact us.
          </p>

          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            We look forward to welcoming you!
          </p>

          <p style="color: #1a1a1a; font-size: 14px; margin-top: 24px;">
            Warm regards,<br>
            <strong>The Riad di Siena Team</strong>
          </p>

          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            Riad di Siena<br>
            <a href="mailto:happy@riaddisiena.com" style="color: #999;">happy@riaddisiena.com</a>
          </p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send guest confirmation:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Combined function to send both emails
export async function sendPaymentEmails(data: BookingEmailData): Promise<{ adminSent: boolean; guestSent: boolean; errors: string[] }> {
  const errors: string[] = [];

  const adminResult = await sendAdminPaymentNotification(data);
  if (!adminResult.success && adminResult.error) {
    errors.push(`Admin email: ${adminResult.error}`);
  }

  const guestResult = await sendGuestPaymentConfirmation(data);
  if (!guestResult.success && guestResult.error) {
    errors.push(`Guest email: ${guestResult.error}`);
  }

  return {
    adminSent: adminResult.success,
    guestSent: guestResult.success,
    errors,
  };
}
