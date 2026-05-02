import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings
import logging
from urllib.parse import quote
from datetime import datetime

logger = logging.getLogger(__name__)


class EmailService:
    """Email service for sending OTP and password reset emails."""
    
    def __init__(self):
        self.smtp_server = settings.SMTP_SERVER
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME
        self.smtp_password = settings.SMTP_PASSWORD
        self.email_from = settings.EMAIL_FROM
    
    def send_email(self, to_email: str, subject: str, html_content: str, text_content: str = None) -> bool:
        """
        Send email via SMTP.
        
        Args:
            to_email: Recipient email
            subject: Email subject
            html_content: HTML body
            text_content: Plain text body (optional)
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.email_from
            msg["To"] = to_email
            
            # Attach plain text and HTML parts
            if text_content:
                msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()  # Secure connection
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except smtplib.SMTPAuthenticationError:
            logger.error(f"SMTP authentication failed for {self.smtp_username}")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error sending email to {to_email}: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Error sending email to {to_email}: {str(e)}")
            return False
    
    def send_otp_email(self, email: str, otp: str, user_name: str = "User") -> bool:
        """Send OTP verification email."""
        subject = "Your OTP Verification Code"
        
        text_content = f"""
Hello {user_name},

Your OTP verification code is: {otp}

This code will expire in 10 minutes.

If you didn't request this, please ignore this email.

Best regards,
Appointment Booking System
        """
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>Email Verification</h2>
                    <p>Hello {user_name},</p>
                    <p>Your OTP verification code is:</p>
                    <div style="background-color: #f0f0f0; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
                        <h1 style="letter-spacing: 5px; color: #333;">{otp}</h1>
                    </div>
                    <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
                    <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">© Appointment Booking System. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        return self.send_email(email, subject, html_content, text_content)
    
    def send_password_reset_email(self, email: str, reset_url: str, user_name: str = "User") -> bool:
        """Send password reset email."""
        subject = "Password Reset Request"
        
        text_content = f"""
Hello {user_name},

We received a request to reset your password. Click the link below to reset it:

{reset_url}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
Appointment Booking System
        """
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>Password Reset Request</h2>
                    <p>Hello {user_name},</p>
                    <p>We received a request to reset your password. Click the button below to reset it:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reset_url}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                    </div>
                    <p>Or copy and paste this link in your browser:</p>
                    <p style="word-break: break-all; color: #0066cc;"><a href="{reset_url}">{reset_url}</a></p>
                    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
                    <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">© Appointment Booking System. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        return self.send_email(email, subject, html_content, text_content)
    
    def send_welcome_email(self, email: str, user_name: str = "User") -> bool:
        """Send welcome email to new user."""
        subject = "Welcome to Appointment Booking System"
        
        text_content = f"""
Hello {user_name},

Welcome to Appointment Booking System!

Your account has been created successfully.

You can now:
- Browse available services
- Book appointments
- Manage your profile

If you have any questions, feel free to contact us.

Best regards,
Appointment Booking System
        """
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1>Welcome to Appointment Booking System!</h1>
                    <p>Hello {user_name},</p>
                    <p>Your account has been created successfully. You can now:</p>
                    <ul>
                        <li>Browse available services</li>
                        <li>Book appointments</li>
                        <li>Manage your profile</li>
                    </ul>
                    <p>If you have any questions, feel free to contact us.</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">© Appointment Booking System. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        return self.send_email(email, subject, html_content, text_content)


    def generate_google_calendar_url(self, title: str, start_time: datetime, end_time: datetime, description: str = "") -> str:
        """
        Generate a Google Calendar intent URL to add appointment to user's calendar.
        
        Args:
            title: Appointment title/service name
            start_time: Appointment start time (datetime with timezone)
            end_time: Appointment end time (datetime with timezone)
            description: Appointment description (optional)
        
        Returns:
            Google Calendar intent URL
        """
        # Format times as required by Google Calendar (YYYYMMDDTHHMMSS format)
        start_str = start_time.strftime("%Y%m%dT%H%M%S")
        end_str = end_time.strftime("%Y%m%dT%H%M%S")
        dates = f"{start_str}/{end_str}"
        
        # URL encode parameters
        calendar_url = (
            "https://calendar.google.com/calendar/render?"
            f"action=TEMPLATE"
            f"&text={quote(title)}"
            f"&dates={dates}"
            f"&details={quote(description)}"
            f"&ctz=UTC"
        )
        return calendar_url

    def send_appointment_confirmation_email(self, email: str, user_name: str, service_name: str, start_time: datetime, end_time: datetime, resource_name: str = None, notes: str = None) -> bool:
        """Send appointment confirmation email with calendar invite link."""
        subject = f"Appointment Confirmation: {service_name}"
        
        # Generate calendar URL
        description = f"Service: {service_name}"
        if resource_name:
            description += f"\nResource: {resource_name}"
        if notes:
            description += f"\nNotes: {notes}"
        
        calendar_url = self.generate_google_calendar_url(service_name, start_time, end_time, description)
        
        # Format times for display
        start_str = start_time.strftime("%Y-%m-%d %H:%M %Z")
        end_str = end_time.strftime("%H:%M %Z")
        
        text_content = f"""
Hello {user_name},

Your appointment has been confirmed!

Service: {service_name}
Date & Time: {start_str} - {end_str}
{f"Resource: {resource_name}" if resource_name else ""}
{f"Notes: {notes}" if notes else ""}

Add to your calendar: {calendar_url}

If you need to reschedule or cancel, please log in to your account.

Best regards,
Appointment Booking System
        """
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>Appointment Confirmation</h2>
                    <p>Hello {user_name},</p>
                    <p>Your appointment has been confirmed!</p>
                    
                    <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #007bff; margin: 20px 0;">
                        <p><strong>Service:</strong> {service_name}</p>
                        <p><strong>Date & Time:</strong> {start_str} - {end_str}</p>
                        {f"<p><strong>Resource:</strong> {resource_name}</p>" if resource_name else ""}
                        {f"<p><strong>Notes:</strong> {notes}</p>" if notes else ""}
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{calendar_url}" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Add to Calendar</a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">If you need to reschedule or cancel, please log in to your account and manage your appointments.</p>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">© Appointment Booking System. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        return self.send_email(email, subject, html_content, text_content)


# Singleton instance
email_service = EmailService()
