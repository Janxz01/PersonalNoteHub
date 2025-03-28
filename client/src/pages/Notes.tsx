import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import NoteCard from "@/components/NoteCard";
import NoteEditor from "@/components/NoteEditor";
import QRCodeScanner from "@/components/QRCodeScanner";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import NoteOfTheDay from "@/components/NoteOfTheDay";
import { Note } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchIcon, QrCodeIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Notes() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Fetch notes
  const {
    data: notes = [],
    isLoading,
    isError,
    error,
  } = useQuery<Note[]>({
    queryKey: ["/api/notes", { archived: showArchived }],
    queryFn: async ({ queryKey }) => {
      const [endpoint, params] = queryKey;
      const url = `${endpoint}?archived=${(params as any).archived}`;
      const response = await apiRequest("GET", url);
      return response.json();
    },
    enabled: isAuthenticated,
    // Add refetch on window focus to ensure lists are updated
    refetchOnWindowFocus: true
  });

  // Log data fetching results
  useEffect(() => {
    if (isError) {
      console.error("Error fetching notes:", error);
    }
    if (notes && notes.length >= 0) {
      console.log("Notes fetched successfully:", notes);
    }
  }, [notes, isError, error]);

  // Delete note mutation
  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", { archived: showArchived }] });
      setShowDeleteModal(false);
      setCurrentNote(null);
    },
  });

  // Create new note
  const handleCreateNote = () => {
    setCurrentNote(null);
    setShowEditor(true);
  };

  // Edit existing note
  const handleEditNote = (note: Note) => {
    setCurrentNote(note);
    setShowEditor(true);
  };

  // Delete note
  const handleDeleteNote = (note: Note) => {
    setCurrentNote(note);
    setShowDeleteModal(true);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (currentNote) {
      deleteMutation.mutate(String(currentNote.id));
    }
  };

  // Filter notes by search term and sort (pinned notes first)
  const filteredNotes = Array.isArray(notes)
    ? notes
        .filter(
          (note: Note) =>
            note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.content.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
          // Sort by pinned status first (pinned notes first)
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          
          // Then sort by updated date (newest first)
          const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return dateB - dateA;
        })
    : [];

  // Loading skeletons
  if (isLoading) {
    return (
      <>
        <Navbar onCreateNote={handleCreateNote} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">My Notes</h1>
            <div className="relative">
              <Skeleton className="h-10 w-64" />
            </div>
          </div>
          
          {/* Note of the Day section */}
          <div className="mb-8">
            <NoteOfTheDay />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </main>
      </>
    );
  }

  // Error state
  if (isError) {
    return (
      <>
        <Navbar onCreateNote={handleCreateNote} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Note of the Day section */}
          <div className="mb-8">
            <NoteOfTheDay />
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
                  Error loading notes
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error instanceof Error ? error.message : "An unexpected error occurred"}</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar onCreateNote={handleCreateNote} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-900">
              {showArchived ? "Archived Notes" : "My Notes"}
            </h1>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
            >
              {showArchived ? "Show Active Notes" : "Show Archived"}
            </button>
          </div>
          <div className="relative">
            <Input
              type="text"
              placeholder="Search notes..."
              className="w-64 pl-10 pr-3"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
        
        {/* Note of the Day section */}
        <div className="mb-8">
          <NoteOfTheDay />
        </div>

        {filteredNotes.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="mt-2 text-sm font-medium text-gray-900">No notes found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {Array.isArray(notes) && notes.length === 0
                ? "Get started by creating a new note."
                : "No notes match your search criteria."}
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={handleCreateNote}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <svg
                  className="-ml-1 mr-2 h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Create a new note
              </button>
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => handleEditNote(note)}
                onDelete={() => handleDeleteNote(note)}
                onClick={() => navigate(`/notes/${note.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {/* QR Code Scanner Button */}
      <div className="fixed bottom-8 right-8">
        <Button 
          className="rounded-full h-14 w-14 shadow-lg"
          onClick={() => setShowQRScanner(true)}
        >
          <QrCodeIcon className="h-6 w-6" />
        </Button>
      </div>

      {/* Note Editor Modal */}
      <NoteEditor
        isOpen={showEditor}
        note={currentNote}
        onClose={() => setShowEditor(false)}
      />

      {/* QR Code Scanner Modal */}
      <QRCodeScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
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