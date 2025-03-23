import { notes, users, type User, type InsertUser, type Note, type InsertNote, type UpdateNote } from "@shared/schema";
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
}

// MongoDB implementation
export class MongoStorage implements IStorage {
  private UserModel: mongoose.Model<any>;
  private NoteModel: mongoose.Model<any>;
  
  constructor() {
    // Initialize models if not already registered
    this.UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
    this.NoteModel = mongoose.models.Note || mongoose.model('Note', NoteSchema);
    
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/notekeeper');
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
      const notes = await this.NoteModel.find({ userId }).sort({ updatedAt: -1 }).lean();
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
      const note = await this.NoteModel.create({
        userId: noteData.userId,
        title: noteData.title,
        content: noteData.content
      });
      
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
      userId: note.userId.toString(),
      title: note.title,
      content: note.content,
      summary: note.summary,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    };
  }
}

// Memory storage fallback for development/testing
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private notes: Map<string, Note>;
  private userId: number;
  private noteId: number;

  constructor() {
    this.users = new Map();
    this.notes = new Map();
    this.userId = 1;
    this.noteId = 1;
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
    const id = String(this.userId++);
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
    
    const user: User = {
      id,
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      createdAt: new Date()
    };
    
    this.users.set(id, user);
    return user;
  }

  async getNotesByUserId(userId: string): Promise<Note[]> {
    return Array.from(this.notes.values()).filter(
      (note) => note.userId === userId
    ).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getNoteById(id: string): Promise<Note | null> {
    return this.notes.get(id) || null;
  }

  async createNote(noteData: InsertNote & { userId: string }): Promise<Note> {
    const id = String(this.noteId++);
    const now = new Date();
    
    const note: Note = {
      id,
      userId: noteData.userId,
      title: noteData.title,
      content: noteData.content,
      summary: undefined,
      createdAt: now,
      updatedAt: now
    };
    
    this.notes.set(id, note);
    return note;
  }

  async updateNote(id: string, noteData: UpdateNote): Promise<Note | null> {
    const note = this.notes.get(id);
    if (!note) return null;
    
    const updatedNote: Note = {
      ...note,
      title: noteData.title,
      content: noteData.content,
      updatedAt: new Date()
    };
    
    this.notes.set(id, updatedNote);
    return updatedNote;
  }

  async deleteNote(id: string): Promise<boolean> {
    return this.notes.delete(id);
  }
}

// Export the appropriate storage implementation
export const useMongoStorage = process.env.MONGODB_URI !== undefined;
export const storage = useMongoStorage ? new MongoStorage() : new MemStorage();
