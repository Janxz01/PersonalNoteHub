import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  XIcon, 
  BoldIcon, 
  ItalicIcon, 
  UnderlineIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  TypeIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Note } from "@shared/schema";

// Note form schema
const noteSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  content: z.string().min(1, { message: "Content is required" }),
  generateSummary: z.boolean().optional().default(false),
  pinned: z.boolean().optional().default(false),
});

type NoteFormValues = z.infer<typeof noteSchema>;

interface NoteEditorProps {
  isOpen: boolean;
  note: Note | null;
  onClose: () => void;
}

export default function NoteEditor({ isOpen, note, onClose }: NoteEditorProps) {
  const { toast } = useToast();
  const isEditing = !!note;

  // Create form
  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      title: note?.title || "",
      content: note?.content || "",
      generateSummary: false,
      pinned: note?.pinned || false,
    },
  });

  // Update form values when note changes
  useEffect(() => {
    if (note) {
      form.reset({
        title: note.title,
        content: note.content,
        generateSummary: false,
        pinned: note.pinned || false,
      });
    } else {
      form.reset({
        title: "",
        content: "",
        generateSummary: false,
        pinned: false,
      });
    }
  }, [note, form]);

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (data: NoteFormValues) => {
      console.log("Creating note with data:", data);
      const res = await apiRequest("POST", "/api/notes", data);
      const result = await res.json();
      console.log("Note creation result:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("Note created successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      onClose();
      toast({
        title: "Note created",
        description: "Your note has been successfully created.",
      });
    },
    onError: (error) => {
      console.error("Error creating note:", error);
      toast({
        title: "Failed to create note",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async (data: NoteFormValues) => {
      if (!note) return null;
      const res = await apiRequest("PUT", `/api/notes/${note.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      if (note) {
        queryClient.invalidateQueries({ queryKey: [`/api/notes/${note.id}`] });
      }
      onClose();
      toast({
        title: "Note updated",
        description: "Your note has been successfully updated.",
      });
    },
  });

  // Form submission
  const onSubmit = (data: NoteFormValues) => {
    if (isEditing) {
      updateNoteMutation.mutate(data);
    } else {
      createNoteMutation.mutate(data);
    }
  };

  // Close editor
  const handleClose = () => {
    form.reset();
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const isSubmitting = createNoteMutation.isPending || updateNoteMutation.isPending;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {isEditing ? "Edit Note" : "Create New Note"}
          </h3>
          <button
            className="text-gray-400 hover:text-gray-500"
            onClick={handleClose}
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Note title"
                      {...field}
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => {
                const textareaRef = useRef<HTMLTextAreaElement | null>(null);
                
                // Insert formatted text at cursor position
                const insertFormatting = (prefix: string, suffix: string = '') => {
                  if (!textareaRef.current) return;
                  
                  const start = textareaRef.current.selectionStart;
                  const end = textareaRef.current.selectionEnd;
                  const text = field.value;
                  const selectedText = text.substring(start, end);
                  
                  const newText = text.substring(0, start) + 
                                  prefix + selectedText + suffix + 
                                  text.substring(end);
                  
                  // Update field value
                  field.onChange(newText);
                  
                  // Restore focus after React re-renders the component
                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                      const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
                      textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                    }
                  }, 0);
                };
                
                return (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <div className="space-y-2">
                      {/* Text formatting toolbar */}
                      <div className="flex flex-wrap gap-1 p-1 border rounded-md bg-gray-50">
                        <Button 
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-gray-600"
                          onClick={() => insertFormatting('# ', '\n')}
                          title="Heading 1"
                        >
                          <Heading1Icon className="h-4 w-4" />
                        </Button>
                        <Button 
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-gray-600"
                          onClick={() => insertFormatting('## ', '\n')}
                          title="Heading 2"
                        >
                          <Heading2Icon className="h-4 w-4" />
                        </Button>
                        <Button 
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-gray-600"
                          onClick={() => insertFormatting('### ', '\n')}
                          title="Heading 3"
                        >
                          <Heading3Icon className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-6 bg-gray-300 my-1 mx-1"></div>
                        <Button 
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-gray-600"
                          onClick={() => insertFormatting('**', '**')}
                          title="Bold"
                        >
                          <BoldIcon className="h-4 w-4" />
                        </Button>
                        <Button 
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-gray-600"
                          onClick={() => insertFormatting('*', '*')}
                          title="Italic"
                        >
                          <ItalicIcon className="h-4 w-4" />
                        </Button>
                        <Button 
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-gray-600"
                          onClick={() => insertFormatting('__', '__')}
                          title="Underline"
                        >
                          <UnderlineIcon className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-6 bg-gray-300 my-1 mx-1"></div>
                        <Button 
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-gray-600"
                          onClick={() => insertFormatting('- ', '\n')}
                          title="Bullet List"
                        >
                          <ListIcon className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <FormControl>
                        <Textarea
                          placeholder="Write your note here..."
                          className="min-h-[200px] font-mono text-base"
                          {...field}
                          ref={(e) => {
                            textareaRef.current = e;
                          }}
                        />
                      </FormControl>
                      <div className="text-xs text-gray-500">
                        Use markdown-style formatting: # for headings, ** for bold, * for italic
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-6">
              <FormField
                control={form.control}
                name="generateSummary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Generate AI summary</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="pinned"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Pin this note</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? isEditing
                    ? "Updating..."
                    : "Saving..."
                  : isEditing
                  ? "Update Note"
                  : "Save Note"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
