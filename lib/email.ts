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
// Verified domain in Resend
const FROM_EMAIL = "Riad di Siena <operations@mail.riaddisiena.com>";

interface BookingEmailData {
  bookingId: string;
  guestName: string;
  guestEmail: string;
  whatsapp?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  room?: string;
  property?: string;
  roomTotal?: number;
  cityTax?: number;
  totalPaid?: number;
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

  const roomTotalStr = data.roomTotal ? `€${data.roomTotal.toFixed(2)}` : "N/A";
  const cityTaxStr = data.cityTax ? `€${data.cityTax.toFixed(2)}` : "N/A";
  const totalPaidStr = data.totalPaid ? `€${data.totalPaid.toFixed(2)}` : "N/A";

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `Payment Received: ${data.guestName} - ${data.room || "Booking"}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 20px;">Payment Confirmation</h2>

          <div style="background: #f8f5f0; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px;">Room (${data.nights} ${data.nights === 1 ? "night" : "nights"})</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 500; text-align: right;">${roomTotalStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px;">City Tax (${data.nights} ${data.nights === 1 ? "night" : "nights"} × ${data.guests} ${data.guests === 1 ? "guest" : "guests"} × €2.50)</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 500; text-align: right;">${cityTaxStr}</td>
              </tr>
              <tr style="border-top: 2px solid #e5e5e5;">
                <td style="padding: 12px 0 0 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">Total Paid</td>
                <td style="padding: 12px 0 0 0; color: #1a1a1a; font-size: 20px; font-weight: 700; text-align: right;">${totalPaidStr}</td>
              </tr>
            </table>
          </div>

          <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Guest Details</h3>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #f0f0f0;">Guest Name</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 500; text-align: right; border-bottom: 1px solid #f0f0f0;">${data.guestName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #f0f0f0;">Email Address</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 500; text-align: right; border-bottom: 1px solid #f0f0f0;">${data.guestEmail || "N/A"}</td>
              </tr>
              ${data.whatsapp ? `<tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #f0f0f0;">WhatsApp</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 500; text-align: right; border-bottom: 1px solid #f0f0f0;">${data.whatsapp}</td>
              </tr>` : ""}
              ${data.room ? `<tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #f0f0f0;">Room</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 500; text-align: right; border-bottom: 1px solid #f0f0f0;">${data.room}</td>
              </tr>` : ""}
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #f0f0f0;">Check-In</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 500; text-align: right; border-bottom: 1px solid #f0f0f0;">${formatDate(data.checkIn)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px;">Check-Out</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 500; text-align: right;">${formatDate(data.checkOut)}</td>
              </tr>
            </table>
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

  const totalPaidStr = data.totalPaid ? `€${data.totalPaid.toFixed(2)}` : "";

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: data.guestEmail,
      subject: `Booking Confirmed - Riad di Siena`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-family: Georgia, serif; color: #1a1a1a; font-size: 28px; font-weight: normal; margin: 0;">Riad di Siena</h1>
          </div>

          <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <div style="width: 48px; height: 48px; background: #dcfce7; border-radius: 50%; margin: 0 auto 16px; line-height: 48px;">
              <span style="color: #16a34a; font-size: 24px;">✓</span>
            </div>
            <h2 style="color: #166534; margin: 0 0 8px 0; font-size: 20px;">Payment Received</h2>
            <p style="color: #15803d; margin: 0; font-size: 14px;">Thank you for your payment${totalPaidStr ? ` of ${totalPaidStr}` : ""}.</p>
          </div>

          <div style="background: #f8f5f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px;">Your Stay Details</h3>

            <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Guest</p>
            <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px;">${data.guestName}</p>

            ${data.room ? `
            <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Room</p>
            <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px;">${data.room}</p>
            ` : ""}

            <table style="width: 100%; margin-bottom: 16px;">
              <tr>
                <td style="padding-right: 20px;">
                  <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Check-In</p>
                  <p style="margin: 0; color: #1a1a1a; font-size: 14px;">${formatDate(data.checkIn)}</p>
                </td>
                <td>
                  <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Check-Out</p>
                  <p style="margin: 0; color: #1a1a1a; font-size: 14px;">${formatDate(data.checkOut)}</p>
                </td>
              </tr>
            </table>

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
