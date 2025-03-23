import { useEffect } from "react";
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
import { XIcon } from "lucide-react";
import { Note } from "@shared/schema";

// Note form schema
const noteSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  content: z.string().min(1, { message: "Content is required" }),
  generateSummary: z.boolean().optional().default(false),
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
    },
  });

  // Update form values when note changes
  useEffect(() => {
    if (note) {
      form.reset({
        title: note.title,
        content: note.content,
        generateSummary: false,
      });
    } else {
      form.reset({
        title: "",
        content: "",
        generateSummary: false,
      });
    }
  }, [note, form]);

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (data: NoteFormValues) => {
      const res = await apiRequest("POST", "/api/notes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      onClose();
      toast({
        title: "Note created",
        description: "Your note has been successfully created.",
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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Write your note here..."
                      className="min-h-[200px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
