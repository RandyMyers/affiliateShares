const User = require('../models/user');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { successResponse, errorResponse } = require('../utils/response');
const crypto = require('crypto');
const emailService = require('../services/emailService');

/**
 * Register a new user
 */
const register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return errorResponse(res, 400, 'User with this email or username already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const userRole = role || 'affiliate';
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      role: userRole,
      emailVerificationToken
    });
    
    // Generate merchant ID for merchants/advertisers if not already generated
    if ((userRole === 'advertiser' || userRole === 'admin') && !user.merchantId) {
      user.generateMerchantId();
      await user.save();
    }

    // Generate tokens
    const token = generateToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id });

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Send verification email - COMMENTED OUT FOR NOW (no email credentials configured)
    // try {
    //   await emailService.sendVerificationEmail(user.email, emailVerificationToken);
    // } catch (emailError) {
    //   console.error('Error sending verification email:', emailError);
    //   // Don't fail registration if email fails
    // }

    // Remove sensitive data from response
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified
    };

    return successResponse(res, 201, 'User registered successfully', {
      user: userResponse,
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    return errorResponse(res, 500, error.message || 'Registration failed');
  }
};

/**
 * Login user
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    // Update last login
    user.lastLogin = new Date();
    
    // Generate tokens
    const token = generateToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id });

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Remove sensitive data from response
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      merchantId: user.merchantId || null
    };

    return successResponse(res, 200, 'Login successful', {
      user: userResponse,
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(res, 500, error.message || 'Login failed');
  }
};

/**
 * Refresh access token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return errorResponse(res, 400, 'Refresh token is required');
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(token);

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== token) {
      return errorResponse(res, 401, 'Invalid refresh token');
    }

    // Generate new access token
    const newToken = generateToken({ userId: user._id, role: user.role });

    return successResponse(res, 200, 'Token refreshed', {
      token: newToken
    });
  } catch (error) {
    return errorResponse(res, 401, error.message || 'Invalid refresh token');
  }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  try {
    const userId = req.userId;

    // Clear refresh token
    await User.findByIdAndUpdate(userId, { refreshToken: null });

    return successResponse(res, 200, 'Logout successful');
  } catch (error) {
    return errorResponse(res, 500, error.message || 'Logout failed');
  }
};

/**
 * Forgot password - Send reset email
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return successResponse(res, 200, 'If email exists, password reset link has been sent');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(resetExpires);
    await user.save();

    // Send reset email - COMMENTED OUT FOR NOW (no email credentials configured)
    // try {
    //   await emailService.sendPasswordResetEmail(user.email, resetToken);
    // } catch (emailError) {
    //   console.error('Error sending reset email:', emailError);
    //   return errorResponse(res, 500, 'Error sending reset email');
    // }

    return successResponse(res, 200, 'If email exists, password reset link has been sent');
  } catch (error) {
    return errorResponse(res, 500, error.message || 'Password reset request failed');
  }
};

/**
 * Reset password
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return errorResponse(res, 400, 'Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    return successResponse(res, 200, 'Password reset successful');
  } catch (error) {
    return errorResponse(res, 500, error.message || 'Password reset failed');
  }
};

/**
 * Verify email
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    const user = await User.findOne({ emailVerificationToken: token });

    if (!user) {
      return errorResponse(res, 400, 'Invalid verification token');
    }

    if (user.emailVerified) {
      return errorResponse(res, 400, 'Email already verified');
    }

    // Verify email
    user.emailVerified = true;
    user.emailVerificationToken = null;
    await user.save();

    return successResponse(res, 200, 'Email verified successfully');
  } catch (error) {
    return errorResponse(res, 500, error.message || 'Email verification failed');
  }
};

/**
 * Verify JWT token and return user info
 */
const verifyToken = async (req, res) => {
  try {
    // Token is already verified by authenticateToken middleware
    // If we reach here, token is valid
    const user = req.user;
    
    return successResponse(res, 200, 'Token is valid', {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        merchantId: user.merchantId || null
      },
      valid: true
    });
  } catch (error) {
    return errorResponse(res, 401, error.message || 'Token verification failed');
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyToken
};

