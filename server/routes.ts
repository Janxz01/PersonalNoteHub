import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import { insertUserSchema, loginUserSchema, insertNoteSchema, updateNoteSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import { summarizeNote } from "./openai";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

// JWT secret key - should be in environment variable in production
const JWT_SECRET = process.env.JWT_SECRET || "notekeeper-secret-key";
const JWT_EXPIRY = "24h";

// Authentication middleware
const authenticateToken = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: "Missing authentication token" });
  }
  
  try {
    const user = jwt.verify(token, JWT_SECRET);
    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: Function) => {
    console.error(err.stack);
    if (err instanceof ZodError) {
      return res.status(400).json({ message: fromZodError(err).message });
    }
    return res.status(500).json({ message: err.message || "Something went wrong" });
  });

  // ===== Authentication Routes =====
  // Register a new user
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(409).json({ message: "User with this email already exists" });
      }
      
      // Create new user
      const user = await storage.createUser(userData);
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      
      res.status(201).json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Failed to register user" });
    }
  });
  
  // Login a user
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const loginData = loginUserSchema.parse(req.body);
      
      // Find user by email
      const user = await storage.getUserByEmail(loginData.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Verify password
      const passwordMatch = await bcrypt.compare(loginData.password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      
      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Failed to log in" });
    }
  });

  // Get current user
  app.get("/api/auth/me", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      res.json({
        id: user.id,
        name: user.name,
        email: user.email
      });
    } catch (error) {
      console.error("Error getting current user:", error);
      res.status(500).json({ message: "Failed to get user information" });
    }
  });
  
  // ===== Notes Routes =====
  // Get all notes for the authenticated user
  app.get("/api/notes", authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const notes = await storage.getNotesByUserId(userId);
      res.json(notes);
    } catch (error) {
      console.error("Error getting notes:", error);
      res.status(500).json({ message: "Failed to get notes" });
    }
  });
  
  // Get a single note by ID
  app.get("/api/notes/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const noteId = req.params.id;
      const userId = (req as any).user.id;
      
      const note = await storage.getNoteById(noteId);
      
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      // Ensure the note belongs to the authenticated user
      if (note.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(note);
    } catch (error) {
      console.error("Error getting note:", error);
      res.status(500).json({ message: "Failed to get note" });
    }
  });
  
  // Create a new note
  app.post("/api/notes", authenticateToken, async (req: Request, res: Response) => {
    try {
      const noteData = insertNoteSchema.parse(req.body);
      const userId = (req as any).user.id;
      const generateSummary = req.body.generateSummary === true;
      
      // Create the note
      const note = await storage.createNote({
        ...noteData,
        userId
      });
      
      // Generate AI summary if requested
      if (generateSummary && process.env.OPENAI_API_KEY) {
        try {
          const summary = await summarizeNote(noteData.content);
          const updatedNote = await storage.updateNote(note.id, {
            ...noteData,
            summary
          });
          return res.status(201).json(updatedNote);
        } catch (summaryError) {
          console.error("Error generating summary:", summaryError);
          // Continue without summary
          return res.status(201).json({
            ...note,
            summaryError: "Failed to generate summary"
          });
        }
      }
      
      res.status(201).json(note);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: formatError(error).message });
      }
      console.error("Error creating note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });
  
  // Update a note
  app.put("/api/notes/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const noteId = req.params.id;
      const noteData = updateNoteSchema.parse(req.body);
      const userId = (req as any).user.id;
      const generateSummary = req.body.generateSummary === true;
      
      // Check if note exists and belongs to user
      const existingNote = await storage.getNoteById(noteId);
      if (!existingNote) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      if (existingNote.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Update the note
      let updatedNote = await storage.updateNote(noteId, noteData);
      
      // Generate AI summary if requested
      if (generateSummary && process.env.OPENAI_API_KEY) {
        try {
          const summary = await summarizeNote(noteData.content);
          updatedNote = await storage.updateNote(noteId, {
            ...noteData,
            summary
          });
        } catch (summaryError) {
          console.error("Error generating summary:", summaryError);
          // Continue without updating summary
          return res.json({
            ...updatedNote,
            summaryError: "Failed to generate summary"
          });
        }
      }
      
      res.json(updatedNote);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: formatError(error).message });
      }
      console.error("Error updating note:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });
  
  // Delete a note
  app.delete("/api/notes/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const noteId = req.params.id;
      const userId = (req as any).user.id;
      
      // Check if note exists and belongs to user
      const note = await storage.getNoteById(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      if (note.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Delete the note
      const deleted = await storage.deleteNote(noteId);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete note" });
      }
      
      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });
  
  // Generate AI summary for note content
  app.post("/api/notes/:id/summary", authenticateToken, async (req: Request, res: Response) => {
    try {
      const noteId = req.params.id;
      const userId = (req as any).user.id;
      
      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({ message: "AI summary service is unavailable" });
      }
      
      // Check if note exists and belongs to user
      const note = await storage.getNoteById(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      if (note.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Generate summary
      const summary = await summarizeNote(note.content);
      
      // Update note with summary
      const updatedNote = await storage.updateNote(noteId, {
        ...note,
        summary
      });
      
      res.json(updatedNote);
    } catch (error) {
      console.error("Error generating summary:", error);
      res.status(500).json({ message: "Failed to generate summary" });
    }
  });

  return httpServer;
}
