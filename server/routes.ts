import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import { insertUserSchema, loginUserSchema, insertNoteSchema, updateNoteSchema, insertLabelSchema, updateLabelSchema } from "@shared/schema";
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
      
      // For debugging
      console.log("Login successful for:", user.email);
      
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
      console.log("GET /api/notes - User ID from token:", userId, "Type:", typeof userId);
      
      // Get the user to verify their existence
      const user = await storage.getUser(userId);
      console.log("User found:", user);
      
      // Get query parameters
      const showArchived = req.query.archived === 'true';
      const labelId = req.query.labelId as string | undefined;
      
      // Fetch all notes for the user
      let notes = await storage.getNotesByUserId(String(userId));
      console.log("Notes found for user:", notes);
      
      // Filter by archive status
      if (!showArchived) {
        notes = notes.filter(note => !note.archived);
      }
      
      // Filter by label if specified
      if (labelId) {
        notes = notes.filter(note => 
          note.labels && 
          note.labels.includes(labelId)
        );
      }
      
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
      // Convert userId to number if comparing with a number
      const userIdNum = typeof note.userId === 'number' ? userId : parseInt(userId, 10);
      if (note.userId !== userIdNum) {
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
      console.log("POST /api/notes - Request body:", req.body);
      const noteData = insertNoteSchema.parse(req.body);
      const userId = (req as any).user.id;
      console.log("Creating note for user ID:", userId);
      const generateSummary = req.body.generateSummary === true;
      
      // Create the note
      const note = await storage.createNote({
        ...noteData,
        userId
      });
      
      console.log("Note created successfully:", note);
      
      // Generate AI summary if requested
      if (generateSummary && process.env.OPENAI_API_KEY) {
        try {
          const summary = await summarizeNote(noteData.content);
          // Convert numeric id to string if needed
          const noteIdStr = typeof note.id === 'number' ? String(note.id) : note.id;
          const updatedNote = await storage.updateNote(noteIdStr, {
            ...noteData,
            summary
          });
          console.log("Note updated with summary:", updatedNote);
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
        return res.status(400).json({ message: fromZodError(error).message });
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
      
      // Convert userId to number if comparing with a number
      const userIdNum = typeof existingNote.userId === 'number' ? userId : parseInt(userId, 10);
      if (existingNote.userId !== userIdNum) {
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
        return res.status(400).json({ message: fromZodError(error).message });
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
      
      // Convert userId to number if comparing with a number
      const userIdNum = typeof note.userId === 'number' ? userId : parseInt(userId, 10);
      if (note.userId !== userIdNum) {
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
  
  // Toggle pin status for a note
  app.patch("/api/notes/:id/pin", authenticateToken, async (req: Request, res: Response) => {
    try {
      const noteId = req.params.id;
      const userId = (req as any).user.id;
      
      // Check if the note exists
      const note = await storage.getNoteById(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      // Check if the user owns the note
      const userIdNum = typeof note.userId === 'number' ? userId : parseInt(userId, 10);
      if (note.userId !== userIdNum) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Toggle the pin status
      const updatedNote = await storage.updateNote(noteId, {
        ...note,
        pinned: !note.pinned
      });
      
      if (!updatedNote) {
        return res.status(500).json({ message: "Failed to update note" });
      }
      
      res.json(updatedNote);
    } catch (error) {
      console.error("Error toggling note pin status:", error);
      res.status(500).json({ message: "Failed to update note" });
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
      
      // Convert userId to number if comparing with a number
      const userIdNum = typeof note.userId === 'number' ? userId : parseInt(userId, 10);
      if (note.userId !== userIdNum) {
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

  // ===== Labels Routes =====
  // Get all labels for the authenticated user
  app.get("/api/labels", authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const labels = await storage.getLabelsByUserId(String(userId));
      res.json(labels);
    } catch (error) {
      console.error("Error getting labels:", error);
      res.status(500).json({ message: "Failed to get labels" });
    }
  });
  
  // Get a single label by ID
  app.get("/api/labels/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const labelId = req.params.id;
      const userId = (req as any).user.id;
      
      const label = await storage.getLabelById(labelId);
      
      if (!label) {
        return res.status(404).json({ message: "Label not found" });
      }
      
      // Ensure the label belongs to the authenticated user
      const userIdNum = typeof label.userId === 'number' ? userId : parseInt(userId, 10);
      if (label.userId !== userIdNum) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(label);
    } catch (error) {
      console.error("Error getting label:", error);
      res.status(500).json({ message: "Failed to get label" });
    }
  });
  
  // Create a new label
  app.post("/api/labels", authenticateToken, async (req: Request, res: Response) => {
    try {
      const labelData = insertLabelSchema.parse(req.body);
      const userId = (req as any).user.id;
      
      // Create the label
      const label = await storage.createLabel({
        ...labelData,
        userId
      });
      
      res.status(201).json(label);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating label:", error);
      res.status(500).json({ message: "Failed to create label" });
    }
  });
  
  // Update a label
  app.put("/api/labels/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const labelId = req.params.id;
      const labelData = updateLabelSchema.parse(req.body);
      const userId = (req as any).user.id;
      
      // Check if label exists and belongs to user
      const existingLabel = await storage.getLabelById(labelId);
      if (!existingLabel) {
        return res.status(404).json({ message: "Label not found" });
      }
      
      // Convert userId to number if comparing with a number
      const userIdNum = typeof existingLabel.userId === 'number' ? userId : parseInt(userId, 10);
      if (existingLabel.userId !== userIdNum) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Update the label
      const updatedLabel = await storage.updateLabel(labelId, labelData);
      
      res.json(updatedLabel);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error updating label:", error);
      res.status(500).json({ message: "Failed to update label" });
    }
  });
  
  // Delete a label
  app.delete("/api/labels/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const labelId = req.params.id;
      const userId = (req as any).user.id;
      
      // Check if label exists and belongs to user
      const label = await storage.getLabelById(labelId);
      if (!label) {
        return res.status(404).json({ message: "Label not found" });
      }
      
      // Convert userId to number if comparing with a number
      const userIdNum = typeof label.userId === 'number' ? userId : parseInt(userId, 10);
      if (label.userId !== userIdNum) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Delete the label
      const deleted = await storage.deleteLabel(labelId);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete label" });
      }
      
      res.json({ message: "Label deleted successfully" });
    } catch (error) {
      console.error("Error deleting label:", error);
      res.status(500).json({ message: "Failed to delete label" });
    }
  });
  
  // Toggle archive status for a note
  app.patch("/api/notes/:id/archive", authenticateToken, async (req: Request, res: Response) => {
    try {
      const noteId = req.params.id;
      const userId = (req as any).user.id;
      
      // Check if the note exists
      const note = await storage.getNoteById(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      // Check if the user owns the note
      const userIdNum = typeof note.userId === 'number' ? userId : parseInt(userId, 10);
      if (note.userId !== userIdNum) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Toggle the archive status
      const updatedNote = await storage.updateNote(noteId, {
        ...note,
        archived: !note.archived
      });
      
      if (!updatedNote) {
        return res.status(500).json({ message: "Failed to update note" });
      }
      
      res.json(updatedNote);
    } catch (error) {
      console.error("Error toggling note archive status:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });
  
  // Add or remove a label from a note
  app.patch("/api/notes/:noteId/labels/:labelId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { noteId, labelId } = req.params;
      const userId = (req as any).user.id;
      const { action } = req.body; // "add" or "remove"
      
      if (action !== "add" && action !== "remove") {
        return res.status(400).json({ message: "Action must be 'add' or 'remove'" });
      }
      
      // Check if note exists and belongs to user
      const note = await storage.getNoteById(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      // Check if label exists and belongs to user
      const label = await storage.getLabelById(labelId);
      if (!label) {
        return res.status(404).json({ message: "Label not found" });
      }
      
      // Ensure both note and label belong to the authenticated user
      const userIdNum = typeof note.userId === 'number' ? userId : parseInt(userId, 10);
      if (note.userId !== userIdNum) {
        return res.status(403).json({ message: "Access denied for note" });
      }
      
      const labelUserIdNum = typeof label.userId === 'number' ? userId : parseInt(userId, 10);
      if (label.userId !== labelUserIdNum) {
        return res.status(403).json({ message: "Access denied for label" });
      }
      
      // Get current labels array or initialize it
      const currentLabels = note.labels || [];
      const labelIdStr = typeof labelId === 'number' ? String(labelId) : labelId;
      
      let updatedLabels;
      if (action === "add") {
        // Add label if it doesn't exist yet
        if (!currentLabels.includes(labelIdStr)) {
          updatedLabels = [...currentLabels, labelIdStr];
        } else {
          // Label already exists, no change needed
          updatedLabels = currentLabels;
        }
      } else {
        // Remove label
        updatedLabels = currentLabels.filter(id => id !== labelIdStr);
      }
      
      // Update the note with new labels
      const updatedNote = await storage.updateNote(noteId, {
        ...note,
        labels: updatedLabels
      });
      
      res.json(updatedNote);
    } catch (error) {
      console.error("Error updating note labels:", error);
      res.status(500).json({ message: "Failed to update note labels" });
    }
  });

  return httpServer;
}
