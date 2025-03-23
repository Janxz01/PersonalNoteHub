import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import NoteEditor from "@/components/NoteEditor";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import { Note } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeftIcon, Edit2Icon, Trash2Icon, ZapIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function NoteDetail() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/notes/:id");
  const { isAuthenticated } = useAuth();
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { toast } = useToast();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Get note ID from URL
  const noteId = params?.id;

  // Fetch note details
  const {
    data: note,
    isLoading,
    isError,
    error,
  } = useQuery<Note>({
    queryKey: [`/api/notes/${noteId}`],
    enabled: !!noteId && isAuthenticated,
  });

  // Delete note mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!noteId) return;
      await apiRequest("DELETE", `/api/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      navigate("/");
      toast({
        title: "Note deleted",
        description: "Your note has been successfully deleted.",
      });
    },
  });

  // Generate AI summary mutation
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      if (!noteId) return;
      return apiRequest("POST", `/api/notes/${noteId}/summary`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/notes/${noteId}`] });
      toast({
        title: "Summary generated",
        description: "AI summary has been created for your note.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to generate summary",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  // Handle note deletion
  const handleDeleteNote = () => {
    setShowDeleteModal(true);
  };

  // Confirm delete
  const confirmDelete = () => {
    deleteMutation.mutate();
  };

  // Handle generate summary
  const handleGenerateSummary = () => {
    generateSummaryMutation.mutate();
  };

  // Loading state
  if (isLoading) {
    return (
      <>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center mb-6">
            <Button 
              variant="ghost" 
              className="inline-flex items-center text-primary hover:text-primary/90"
              onClick={() => navigate("/")}
            >
              <ArrowLeftIcon className="mr-1 h-4 w-4" /> Back to notes
            </Button>
            <div className="flex space-x-3">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
          
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-24 w-full" />
        </main>
      </>
    );
  }

  // Error state
  if (isError || !note) {
    return (
      <>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center mb-6">
            <Button 
              variant="ghost" 
              className="inline-flex items-center text-primary hover:text-primary/90"
              onClick={() => navigate("/")}
            >
              <ArrowLeftIcon className="mr-1 h-4 w-4" /> Back to notes
            </Button>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-md p-4 my-4">
            <div className="flex">
              <div className="text-red-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error loading note
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error instanceof Error ? error.message : "Note not found or an unexpected error occurred"}</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  const createdAt = new Date(note.createdAt);
  const updatedAt = new Date(note.updatedAt);
  const isUpdated = createdAt.getTime() !== updatedAt.getTime();

  // Format content for display (preserve newlines)
  const formatContent = (content: string) => {
    // Split by newlines and wrap in appropriate HTML
    return content.split('\n').map((line, index) => {
      // Check if it starts with a list marker (-, *, 1., etc.)
      if (/^\s*[\-\*]\s+/.test(line)) {
        return <li key={index}>{line.replace(/^\s*[\-\*]\s+/, '')}</li>;
      } else if (/^\s*\d+\.\s+/.test(line)) {
        return <li key={index}>{line.replace(/^\s*\d+\.\s+/, '')}</li>;
      } else if (line.trim() === '') {
        return <br key={index} />;
      } else {
        return <p key={index}>{line}</p>;
      }
    });
  };

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-center mb-6">
          <Button 
            variant="ghost" 
            className="inline-flex items-center text-primary hover:text-primary/90"
            onClick={() => navigate("/")}
          >
            <ArrowLeftIcon className="mr-1 h-4 w-4" /> Back to notes
          </Button>
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              className="inline-flex items-center"
              onClick={() => setShowEditor(true)}
            >
              <Edit2Icon className="mr-1 h-4 w-4" /> Edit
            </Button>
            <Button 
              variant="destructive" 
              className="inline-flex items-center"
              onClick={handleDeleteNote}
            >
              <Trash2Icon className="mr-1 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">{note.title}</h2>
          <div className="text-sm text-gray-500 mb-4">
            Created {formatDistanceToNow(createdAt, { addSuffix: true })}
            {isUpdated && ` · Updated ${formatDistanceToNow(updatedAt, { addSuffix: true })}`}
          </div>
          <div className="prose max-w-none mb-6">
            {formatContent(note.content)}
          </div>
        </div>
        
        {note.summary ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <ZapIcon className="text-green-500 mr-2 h-5 w-5" />
              <h3 className="font-medium text-green-800">AI Summary</h3>
            </div>
            <p className="text-green-700 text-sm">{note.summary}</p>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full text-primary hover:bg-primary/10"
            onClick={handleGenerateSummary}
            disabled={generateSummaryMutation.isPending}
          >
            <ZapIcon className="mr-2 h-4 w-4" />
            {generateSummaryMutation.isPending ? "Generating Summary..." : "Generate AI Summary"}
          </Button>
        )}
      </main>

      {/* Note Editor Modal */}
      <NoteEditor
        isOpen={showEditor}
        note={note}
        onClose={() => setShowEditor(false)}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        isDeleting={deleteMutation.isPending}
      />
    </>
  );
}
