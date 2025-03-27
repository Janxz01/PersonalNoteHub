import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { Strategy as LocalStrategy } from 'passport-local';
import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '@shared/schema';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

// Setup passport authentication
export const configurePassport = () => {
  // Serialize user to session
  passport.serializeUser((user: User, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Local strategy for email/password login
  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          
          if (!user) {
            return done(null, false, { message: 'User not found' });
          }
          
          if (!user.password) {
            return done(null, false, { message: 'Login with social account instead' });
          }
          
          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            return done(null, false, { message: 'Incorrect password' });
          }
          
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: '/api/auth/google/callback',
          scope: ['profile', 'email']
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Check if user exists
            let user = await storage.getUserByGoogleId(profile.id);
            
            if (!user) {
              // Check if user with same email exists
              const email = profile.emails && profile.emails[0] && profile.emails[0].value;
              if (email) {
                user = await storage.getUserByEmail(email);
              }
              
              if (user) {
                // Update existing user with Google ID
                // In a real app, you'd update the user record here
                console.log('User with email exists, linking Google account');
              } else {
                // Create new user
                user = await storage.createUser({
                  name: profile.displayName || 'Google User',
                  email: email || `google_${profile.id}@example.com`,
                  googleId: profile.id,
                  avatar: profile.photos?.[0]?.value
                });
              }
            }
            
            return done(null, user);
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }

  // Facebook OAuth Strategy
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: process.env.FACEBOOK_CLIENT_ID,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          callbackURL: '/api/auth/facebook/callback',
          profileFields: ['id', 'displayName', 'photos', 'email']
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Check if user exists
            let user = await storage.getUserByFacebookId(profile.id);
            
            if (!user) {
              // Check if user with same email exists
              const email = profile.emails && profile.emails[0] && profile.emails[0].value;
              if (email) {
                user = await storage.getUserByEmail(email);
              }
              
              if (user) {
                // Update existing user with Facebook ID
                // In a real app, you'd update the user record here
                console.log('User with email exists, linking Facebook account');
              } else {
                // Create new user
                user = await storage.createUser({
                  name: profile.displayName || 'Facebook User',
                  email: email || `facebook_${profile.id}@example.com`,
                  facebookId: profile.id,
                  avatar: profile.photos?.[0]?.value
                });
              }
            }
            
            return done(null, user);
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }

  // Microsoft OAuth Strategy
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    passport.use(
      new MicrosoftStrategy(
        {
          clientID: process.env.MICROSOFT_CLIENT_ID,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
          callbackURL: '/api/auth/microsoft/callback',
          scope: ['user.read']
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Check if user exists
            let user = await storage.getUserByMicrosoftId(profile.id);
            
            if (!user) {
              // Check if user with same email exists
              const email = profile.emails && profile.emails[0] && profile.emails[0].value;
              if (email) {
                user = await storage.getUserByEmail(email);
              }
              
              if (user) {
                // Update existing user with Microsoft ID
                // In a real app, you'd update the user record here
                console.log('User with email exists, linking Microsoft account');
              } else {
                // Create new user
                user = await storage.createUser({
                  name: profile.displayName || 'Microsoft User',
                  email: email || `microsoft_${profile.id}@example.com`,
                  microsoftId: profile.id,
                  avatar: null // Microsoft may not provide a photo
                });
              }
            }
            
            return done(null, user);
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }
};

// Helper function to generate JWT token
export const generateToken = (user: User): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// Authentication middleware
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, JWT_SECRET, async (err, decoded: any) => {
      if (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
      
      try {
        const user = await storage.getUser(decoded.id);
        if (!user) {
          return res.status(401).json({ message: 'User not found' });
        }
        
        req.user = user;
        next();
      } catch (error) {
        return res.status(500).json({ message: 'Server error' });
      }
    });
  } else {
    res.status(401).json({ message: 'Authorization header missing' });
  }
};