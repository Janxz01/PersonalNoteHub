import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const labels = pgTable("labels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"), // Default blue color
  createdAt: timestamp("created_at").defaultNow(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  pinned: boolean("pinned").default(false).notNull(),
  labels: text("labels").array(), // Store label IDs as array
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User schemas
export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  email: true,
  password: true,
});

export const loginUserSchema = z.object({
  email: z.string().email({ message: "Invalid email format" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

// Label schemas
export const insertLabelSchema = createInsertSchema(labels).pick({
  name: true,
  color: true,
});

export const updateLabelSchema = createInsertSchema(labels).pick({
  name: true,
  color: true,
});

// Note schemas
export const insertNoteSchema = createInsertSchema(notes).pick({
  title: true,
  content: true,
  summary: true,
  pinned: true,
  labels: true,
  archived: true,
});

export const updateNoteSchema = createInsertSchema(notes).pick({
  title: true,
  content: true,
  summary: true,
  pinned: true,
  labels: true,
  archived: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertLabel = z.infer<typeof insertLabelSchema>;
export type UpdateLabel = z.infer<typeof updateLabelSchema>;
export type Label = typeof labels.$inferSelect;

export type InsertNote = z.infer<typeof insertNoteSchema>;
export type UpdateNote = z.infer<typeof updateNoteSchema>;
export type Note = typeof notes.$inferSelect;
