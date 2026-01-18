import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST() {
  if (!process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json(
      { error: "GMAIL_APP_PASSWORD not configured" },
      { status: 500 }
    );
  }

  const GMAIL_USER = "happy@riaddisiena.com";

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Test data
    const testData = {
      guestName: "John Smith",
      guestEmail: "john.smith@example.com",
      whatsapp: "+1 555 123 4567",
      checkIn: "Sat, Jan 25, 2026",
      checkOut: "Tue, Jan 28, 2026",
      nights: 3,
      guests: 2,
      amount: "€7.50",
      paymentType: "City Tax",
    };

    await transporter.sendMail({
      from: `"Riad di Siena" <${GMAIL_USER}>`,
      to: "happy@indigoandlavender.love",
      subject: `Payment Received: ${testData.paymentType} - ${testData.guestName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 20px;">Payment Confirmation</h2>

          <div style="background: #f8f5f0; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Payment Type</p>
            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 18px; font-weight: 600;">${testData.paymentType}</p>

            <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Amount Paid</p>
            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 700;">${testData.amount}</p>
          </div>

          <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Guest Details</h3>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #f0f0f0;">Guest Name</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 500; text-align: right; border-bottom: 1px solid #f0f0f0;">${testData.guestName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #f0f0f0;">Email Address</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 500; text-align: right; border-bottom: 1px solid #f0f0f0;">${testData.guestEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #f0f0f0;">WhatsApp</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 500; text-align: right; border-bottom: 1px solid #f0f0f0;">${testData.whatsapp}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #f0f0f0;">Check-In Date</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 500; text-align: right; border-bottom: 1px solid #f0f0f0;">${testData.checkIn}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #f0f0f0;">Check-Out Date</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 500; text-align: right; border-bottom: 1px solid #f0f0f0;">${testData.checkOut}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px;">Amount Paid</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; font-weight: 600; text-align: right;">${testData.amount}</td>
              </tr>
            </table>
          </div>

          <p style="margin-top: 24px; color: #999; font-size: 12px; text-align: center;">
            This is a test email from Riad di Siena Ops
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: "Test email sent to happy@indigoandlavender.love" });
  } catch (error) {
    console.error("Test email error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
