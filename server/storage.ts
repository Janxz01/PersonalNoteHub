import { notes, users, labels, type User, type InsertUser, type Note, type InsertNote, type UpdateNote, type Label, type InsertLabel, type UpdateLabel } from "@shared/schema";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

// Define mongoose schemas
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const NoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  summary: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  
  // Note operations
  getNotesByUserId(userId: string): Promise<Note[]>;
  getNoteById(id: string): Promise<Note | null>;
  createNote(note: InsertNote & { userId: string }): Promise<Note>;
  updateNote(id: string, note: UpdateNote): Promise<Note | null>;
  deleteNote(id: string): Promise<boolean>;
  
  // Label operations
  getLabelsByUserId(userId: string): Promise<Label[]>;
  getLabelById(id: string): Promise<Label | null>;
  createLabel(label: InsertLabel & { userId: string }): Promise<Label>;
  updateLabel(id: string, label: UpdateLabel): Promise<Label | null>;
  deleteLabel(id: string): Promise<boolean>;
}

// MongoDB implementation
export class MongoStorage implements IStorage {
  private UserModel: mongoose.Model<any>;
  private NoteModel: mongoose.Model<any>;
  private LabelModel: mongoose.Model<any>;
  
  constructor() {
    // Define the label schema
    const LabelSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: { type: String, required: true },
      color: { type: String, required: true, default: "#3b82f6" },
      createdAt: { type: Date, default: Date.now }
    });
    
    // Initialize models if not already registered
    this.UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
    this.NoteModel = mongoose.models.Note || mongoose.model('Note', NoteSchema);
    this.LabelModel = mongoose.models.Label || mongoose.model('Label', LabelSchema);
    
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      console.log("Connecting to MongoDB:", process.env.MONGODB_URI || 'mongodb://localhost:27017/notekeeper');
      mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/notekeeper')
        .then(() => console.log("MongoDB connected successfully"))
        .catch(err => console.error("MongoDB connection error:", err));
    } else {
      console.log("MongoDB connection state:", mongoose.connection.readyState);
    }
  }
  
  // User operations
  async getUser(id: string): Promise<User | null> {
    try {
      const user = await this.UserModel.findById(id).lean();
      if (!user) return null;
      return this.mapUserToSchema(user);
    } catch (error) {
      console.error("Error getting user:", error);
      return null;
    }
  }
  
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.UserModel.findOne({ email }).lean();
      if (!user) return null;
      return this.mapUserToSchema(user);
    } catch (error) {
      console.error("Error getting user by email:", error);
      return null;
    }
  }
  
  async createUser(userData: InsertUser): Promise<User> {
    try {
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
      
      // Create new user
      const user = await this.UserModel.create({
        name: userData.name,
        email: userData.email,
        password: hashedPassword
      });
      
      return this.mapUserToSchema(user.toObject());
    } catch (error) {
      console.error("Error creating user:", error);
      throw new Error("Failed to create user");
    }
  }
  
  // Note operations
  async getNotesByUserId(userId: string): Promise<Note[]> {
    try {
      console.log("Looking for notes with userId:", userId);
      // Some MongoDB implementations like Mongoose may not automatically convert string to ObjectId
      // Convert if it's a mongoose ObjectId, otherwise keep as string
      let query: any;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        query = { userId: mongoose.Types.ObjectId.createFromHexString(userId) };
      } else {
        query = { userId };
      }

      const notes = await this.NoteModel.find(query).sort({ updatedAt: -1 }).lean();
      console.log("Found notes:", notes);
      return notes.map(this.mapNoteToSchema);
    } catch (error) {
      console.error("Error getting notes by user id:", error);
      return [];
    }
  }
  
  async getNoteById(id: string): Promise<Note | null> {
    try {
      const note = await this.NoteModel.findById(id).lean();
      if (!note) return null;
      return this.mapNoteToSchema(note);
    } catch (error) {
      console.error("Error getting note by id:", error);
      return null;
    }
  }
  
  async createNote(noteData: InsertNote & { userId: string }): Promise<Note> {
    try {
      console.log("Creating note with userId:", noteData.userId);
      
      const note = await this.NoteModel.create({
        userId: noteData.userId,
        title: noteData.title,
        content: noteData.content,
        summary: noteData.summary || null
      });
      
      console.log("Created note:", note);
      return this.mapNoteToSchema(note.toObject());
    } catch (error) {
      console.error("Error creating note:", error);
      throw new Error("Failed to create note");
    }
  }
  
  async updateNote(id: string, noteData: UpdateNote): Promise<Note | null> {
    try {
      const note = await this.NoteModel.findByIdAndUpdate(
        id,
        { 
          ...noteData, 
          updatedAt: new Date() 
        },
        { new: true }
      ).lean();
      
      if (!note) return null;
      return this.mapNoteToSchema(note);
    } catch (error) {
      console.error("Error updating note:", error);
      return null;
    }
  }
  
  async deleteNote(id: string): Promise<boolean> {
    try {
      const result = await this.NoteModel.deleteOne({ _id: id });
      return result.deletedCount > 0;
    } catch (error) {
      console.error("Error deleting note:", error);
      return false;
    }
  }
  
  // Label operations
  async getLabelsByUserId(userId: string): Promise<Label[]> {
    try {
      console.log("Looking for labels with userId:", userId);
      let query: any;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        query = { userId: mongoose.Types.ObjectId.createFromHexString(userId) };
      } else {
        query = { userId };
      }

      const labels = await this.LabelModel.find(query).sort({ name: 1 }).lean();
      return labels.map(this.mapLabelToSchema);
    } catch (error) {
      console.error("Error getting labels by user id:", error);
      return [];
    }
  }
  
  async getLabelById(id: string): Promise<Label | null> {
    try {
      const label = await this.LabelModel.findById(id).lean();
      if (!label) return null;
      return this.mapLabelToSchema(label);
    } catch (error) {
      console.error("Error getting label by id:", error);
      return null;
    }
  }
  
  async createLabel(labelData: InsertLabel & { userId: string }): Promise<Label> {
    try {
      const label = await this.LabelModel.create({
        userId: labelData.userId,
        name: labelData.name,
        color: labelData.color || "#3b82f6"
      });
      
      return this.mapLabelToSchema(label.toObject());
    } catch (error) {
      console.error("Error creating label:", error);
      throw new Error("Failed to create label");
    }
  }
  
  async updateLabel(id: string, labelData: UpdateLabel): Promise<Label | null> {
    try {
      const label = await this.LabelModel.findByIdAndUpdate(
        id,
        { 
          name: labelData.name,
          color: labelData.color || "#3b82f6"  // Ensure color always has a value
        },
        { new: true }
      ).lean();
      
      if (!label) return null;
      return this.mapLabelToSchema(label);
    } catch (error) {
      console.error("Error updating label:", error);
      return null;
    }
  }
  
  async deleteLabel(id: string): Promise<boolean> {
    try {
      const result = await this.LabelModel.deleteOne({ _id: id });
      return result.deletedCount > 0;
    } catch (error) {
      console.error("Error deleting label:", error);
      return false;
    }
  }

  // Helper methods to map MongoDB documents to schema types
  private mapUserToSchema(user: any): User {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      password: user.password,
      createdAt: user.createdAt
    };
  }
  
  private mapNoteToSchema(note: any): Note {
    return {
      id: note._id.toString(),
      userId: note.userId && typeof note.userId.toString === 'function' ? note.userId.toString() : note.userId,
      title: note.title,
      content: note.content,
      summary: note.summary,
      pinned: note.pinned || false,
      labels: note.labels || [],
      archived: note.archived || false,
      backgroundColor: note.backgroundColor || "#ffffff",
      fontSize: note.fontSize || "normal",
      textFormatting: note.textFormatting || "{}",
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    };
  }
  
  private mapLabelToSchema(label: any): Label {
    return {
      id: label._id.toString(),
      userId: label.userId && typeof label.userId.toString === 'function' ? label.userId.toString() : label.userId,
      name: label.name,
      color: label.color,
      createdAt: label.createdAt
    };
  }
}

// Memory storage fallback for development/testing
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private notes: Map<string, Note>;
  private labels: Map<string, Label>;
  private userId: number;
  private noteId: number;
  private labelId: number;

  constructor() {
    this.users = new Map();
    this.notes = new Map();
    this.labels = new Map();
    this.userId = 1;
    this.noteId = 1;
    this.labelId = 1;
    
    // Add a test user for development
    this.addTestUser();
  }
  
  private async addTestUser() {
    try {
      const testUser = {
        name: "Test User",
        email: "test@example.com",
        password: "password123"
      };
      await this.createUser(testUser);
      console.log("Test user created: test@example.com / password123");
    } catch (error) {
      console.error("Failed to create test user:", error);
    }
  }

  async getUser(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(
      (user) => user.email === email
    );
    return user || null;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userId++;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
    
    const user: User = {
      id,
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      createdAt: new Date()
    };
    
    this.users.set(String(id), user);
    return user;
  }

  async getNotesByUserId(userId: string): Promise<Note[]> {
    console.log("MemStorage - Getting notes for userId:", userId);
    console.log("MemStorage - All notes:", Array.from(this.notes.entries()));
    
    const filteredNotes = Array.from(this.notes.values())
      .filter((note) => {
        const match = String(note.userId) === userId;
        console.log(`MemStorage - Note ${note.id} userId: ${note.userId} (${typeof note.userId}), target userId: ${userId} (${typeof userId}), match: ${match}`);
        return match;
      })
      .sort((a, b) => {
        // First sort by pinned status (pinned notes first)
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        
        // Then sort by update time (newer first)
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });
    
    console.log("MemStorage - Filtered notes:", filteredNotes);
    return filteredNotes;
  }

  async getNoteById(id: string): Promise<Note | null> {
    return this.notes.get(id) || null;
  }

  async createNote(noteData: InsertNote & { userId: string }): Promise<Note> {
    const id = this.noteId++;
    const now = new Date();
    
    const note: Note = {
      id,
      userId: parseInt(noteData.userId, 10),
      title: noteData.title,
      content: noteData.content,
      summary: null,
      pinned: noteData.pinned || false,
      labels: noteData.labels || [],
      archived: noteData.archived || false,
      backgroundColor: noteData.backgroundColor || "#ffffff",
      fontSize: noteData.fontSize || "normal",
      textFormatting: noteData.textFormatting || "{}",
      createdAt: now,
      updatedAt: now
    };
    
    this.notes.set(String(id), note);
    return note;
  }

  async updateNote(id: string, noteData: UpdateNote): Promise<Note | null> {
    const note = this.notes.get(id);
    if (!note) return null;
    
    const updatedNote: Note = {
      ...note,
      title: noteData.title || note.title,
      content: noteData.content || note.content,
      pinned: noteData.pinned !== undefined ? noteData.pinned : note.pinned,
      labels: noteData.labels !== undefined ? noteData.labels : note.labels,
      archived: noteData.archived !== undefined ? noteData.archived : note.archived,
      backgroundColor: noteData.backgroundColor !== undefined ? noteData.backgroundColor : note.backgroundColor,
      fontSize: noteData.fontSize !== undefined ? noteData.fontSize : note.fontSize,
      textFormatting: noteData.textFormatting !== undefined ? noteData.textFormatting : note.textFormatting,
      updatedAt: new Date()
    };
    
    this.notes.set(id, updatedNote);
    return updatedNote;
  }

  async deleteNote(id: string): Promise<boolean> {
    return this.notes.delete(id);
  }
  
  // Label operations
  async getLabelsByUserId(userId: string): Promise<Label[]> {
    return Array.from(this.labels.values())
      .filter((label) => String(label.userId) === userId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getLabelById(id: string): Promise<Label | null> {
    return this.labels.get(id) || null;
  }

  async createLabel(labelData: InsertLabel & { userId: string }): Promise<Label> {
    const id = this.labelId++;
    const now = new Date();
    
    const label: Label = {
      id,
      userId: parseInt(labelData.userId, 10),
      name: labelData.name,
      color: labelData.color || "#3b82f6",
      createdAt: now
    };
    
    this.labels.set(String(id), label);
    return label;
  }

  async updateLabel(id: string, labelData: UpdateLabel): Promise<Label | null> {
    const label = this.labels.get(id);
    if (!label) return null;
    
    // Ensure we have a string for the color
    const colorValue: string = labelData.color as string || label.color;
    
    const updatedLabel: Label = {
      ...label,
      name: labelData.name as string,
      color: colorValue
    };
    
    this.labels.set(id, updatedLabel);
    return updatedLabel;
  }

  async deleteLabel(id: string): Promise<boolean> {
    return this.labels.delete(id);
  }
}

// Force using in-memory storage for now
export const useMongoStorage = false;
console.log("Using in-memory storage for reliable local development");
export const storage = new MemStorage();
