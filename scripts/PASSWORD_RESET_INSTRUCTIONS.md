# Password Reset Instructions

Since the email system is not set up yet, you can reset passwords manually using the reset script.

## Usage

From the `server` directory, run:

```bash
node scripts/resetPassword.js <email> <newPassword>
```

## Examples

### Reset password for merchant account:
```bash
node scripts/resetPassword.js merchant@test.com password123
```

### Reset password for affiliate account:
```bash
node scripts/resetPassword.js affiliate@test.com password123
```

## Requirements

- Password must be at least 6 characters long
- Email must match exactly (case-insensitive)
- MongoDB connection must be configured in `.env`

## What the script does:

1. Connects to MongoDB
2. Finds the user by email
3. Hashes the new password using bcrypt
4. Updates the password in the database
5. Displays confirmation

## Security Note

⚠️ **Remember to change the password after logging in for better security!**

