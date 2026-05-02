# Email Setup Guide - SMTP Configuration

Your appointment booking system now sends real emails for OTP verification and password resets!

## Quick Setup Options

### Option 1: Gmail (Easiest for Testing)

1. **Enable 2-Factor Authentication**
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer" (or your device)
   - Google will generate a 16-character password
   - Copy this password

3. **Update .env**
   ```
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your-email@gmail.com
   SMTP_PASSWORD=your-16-char-app-password
   EMAIL_FROM=your-email@gmail.com
   FRONTEND_URL=http://localhost:3000
   ```

4. **Test It**
   - Register a user: `/api/auth/register`
   - Check your email inbox

---

### Option 2: Outlook/Hotmail

```
SMTP_SERVER=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USERNAME=your-email@outlook.com
SMTP_PASSWORD=your-password
EMAIL_FROM=your-email@outlook.com
```

---

### Option 3: Gmail Business Account

```
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@yourdomain.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=your-email@yourdomain.com
```

---

### Option 4: SendGrid (Production Recommended)

1. **Sign up for free**: https://sendgrid.com/free
2. **Create API Key**
3. **Update config to use SendGrid's SMTP**:
   ```
   SMTP_SERVER=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USERNAME=apikey
   SMTP_PASSWORD=SG.your-api-key-here
   EMAIL_FROM=noreply@yourdomain.com
   ```

---

### Option 5: AWS SES

1. **Verify domain/email** in AWS SES
2. **Create SMTP credentials**
3. **Update .env**:
   ```
   SMTP_SERVER=email-smtp.us-east-1.amazonaws.com
   SMTP_PORT=587
   SMTP_USERNAME=your-ses-username
   SMTP_PASSWORD=your-ses-password
   EMAIL_FROM=noreply@yourdomain.com
   ```

---

## Email Templates

The system sends three types of emails:

### 1. OTP Verification Email
- Triggered on: `/api/auth/send-otp`
- Contains: 6-digit OTP code
- Expires: 10 minutes
- Template: Professional HTML + plain text

### 2. Password Reset Email
- Triggered on: `/api/auth/forgot-password`
- Contains: Reset link with token
- Expires: 1 hour
- Template: Professional HTML + plain text

### 3. Welcome Email (Optional)
- Can be sent on: `/api/auth/register`
- Contains: Welcome message
- Template: Professional HTML + plain text

---

## Testing Email Sending

### 1. Test OTP Email
```bash
curl -X POST http://localhost:8000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com"}'
```

Check your email inbox for the OTP.

### 2. Test Password Reset Email
```bash
curl -X POST http://localhost:8000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com"}'
```

Check your email inbox for the reset link.

---

## Troubleshooting

### "SMTP authentication failed"
- Verify SMTP_USERNAME and SMTP_PASSWORD in .env
- Gmail: Use app password, not regular password
- Check if 2FA is enabled on Gmail

### "Connection refused"
- Verify SMTP_SERVER and SMTP_PORT are correct
- Check firewall/network allows SMTP (port 587)
- Gmail users: Port 587 is standard

### "Email not received"
- Check spam/junk folder
- Verify EMAIL_FROM is correct
- Check email service logs

### "Timeout error"
- Gmail might be blocking your connection
- Try: `SMTP_PORT=465` (SSL instead of TLS)
- Or contact your email provider

---

## Email Service Architecture

The system uses a modular email service:

```python
# From email_service.py
email_service.send_otp_email(email, otp, user_name)
email_service.send_password_reset_email(email, reset_url, user_name)
```

### Features
- ✅ HTML + Plain text emails (for compatibility)
- ✅ Professional email templates
- ✅ Error logging
- ✅ Graceful failure handling
- ✅ Reusable service

---

## Production Recommendations

1. **Use SendGrid or AWS SES** - Better deliverability, scalability
2. **Monitor email delivery** - Track bounces, opens
3. **Set up SPF/DKIM/DMARC** - Improve email reputation
4. **Use transactional email service** - Not general SMTP
5. **Rate limiting** - Don't spam users
6. **Email templates** - Store in database for easy updates

---

## SMTP Ports Reference

| Port | Protocol | Use Case |
|------|----------|----------|
| 25 | SMTP | Legacy, often blocked |
| 465 | SMTPS (SSL) | Secure, modern |
| 587 | SMTP + STARTTLS | Standard, recommended |

---

## Need Help?

Check logs for detailed error messages:
```bash
# On Linux/Mac
tail -f /var/log/mail.log

# On Docker
docker logs container-name
```

Enable debug logging in your app to see email sending attempts.

---

## Next Steps

1. Configure your email provider in `.env`
2. Test with `/api/auth/send-otp`
3. Verify emails arrive
4. Move to Phase 2!
