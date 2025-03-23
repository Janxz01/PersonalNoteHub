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
      
      // Convert to ObjectId if the userId is a valid ObjectId, otherwise keep as is
      let userId: any = noteData.userId;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        userId = mongoose.Types.ObjectId.createFromHexString(userId);
      }
      
      const note = await this.NoteModel.create({
        userId: userId,
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
// For now, we'll just use the MemStorage for reliable local development
// Change this to use MongoDB in production with proper connection string
export const useMongoStorage = process.env.MONGODB_URI !== undefined;
console.log("Using MongoDB Storage:", useMongoStorage, "MONGODB_URI defined:", process.env.MONGODB_URI !== undefined);
export const storage = useMongoStorage ? new MongoStorage() : new MemStorage();
