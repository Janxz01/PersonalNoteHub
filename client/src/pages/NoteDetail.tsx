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

  // Convert date strings to dates
  const createdAt = typeof note.createdAt === 'string' 
    ? new Date(note.createdAt) 
    : note.createdAt instanceof Date 
      ? note.createdAt 
      : new Date();
  
  const updatedAt = typeof note.updatedAt === 'string' 
    ? new Date(note.updatedAt) 
    : note.updatedAt instanceof Date 
      ? note.updatedAt 
      : new Date();
  
  const isUpdated = createdAt.getTime() !== updatedAt.getTime();

  // Format content for display with Markdown-like formatting
  const formatContent = (content: string) => {
    if (!content) return null;
    
    // Split by newlines and process line by line
    return content.split('\n').map((line, index) => {
      // Heading processing (# Heading)
      if (/^#{1,3}\s+/.test(line)) {
        const level = line.match(/^(#+)/)?.[0].length || 1;
        const text = line.replace(/^#+\s+/, '');
        
        switch(level) {
          case 1:
            return <h1 key={index} className="text-2xl font-bold mt-4 mb-2">{text}</h1>;
          case 2:
            return <h2 key={index} className="text-xl font-bold mt-3 mb-2">{text}</h2>;
          case 3:
            return <h3 key={index} className="text-lg font-bold mt-2 mb-1">{text}</h3>;
          default:
            return <p key={index}>{text}</p>;
        }
      }
      
      // Bullet lists (- Item or * Item)
      if (/^\s*[\-\*]\s+/.test(line)) {
        const text = line.replace(/^\s*[\-\*]\s+/, '');
        // Process inline formatting in list items
        return <li key={index} className="ml-6">{processInlineFormatting(text)}</li>;
      } 
      
      // Numbered lists (1. Item)
      else if (/^\s*\d+\.\s+/.test(line)) {
        const text = line.replace(/^\s*\d+\.\s+/, '');
        return <li key={index} className="ml-6 list-decimal">{processInlineFormatting(text)}</li>;
      } 
      
      // Empty lines
      else if (line.trim() === '') {
        return <br key={index} />;
      } 
      
      // Regular paragraph with inline formatting
      else {
        return <p key={index} className="mb-2">{processInlineFormatting(line)}</p>;
      }
    });
  };
  
  // Process inline formatting (bold, italic, underline)
  const processInlineFormatting = (text: string) => {
    // Need to process the text and return an array of strings and JSX elements
    // This is simplified and doesn't handle nested formatting
    
    // Process bold (**text**)
    if (text.includes('**')) {
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // Extract the text between ** markers
          const boldText = part.slice(2, -2);
          return <strong key={i} className="font-bold">{boldText}</strong>;
        }
        // Check if this part contains italic or underline formatting
        if (part.includes('*') || part.includes('__')) {
          return processItalicAndUnderline(part, i);
        }
        return part;
      });
    }
    
    // If no bold formatting, check for italic and underline
    return processItalicAndUnderline(text, 0);
  };
  
  // Process italic (*text*) and underline (__text__)
  const processItalicAndUnderline = (text: string, baseKey: number) => {
    if (!text.includes('*') && !text.includes('__')) return text;
    
    // This is a very simplified approach - a real markdown parser would be more robust
    
    // Process italic first
    if (text.includes('*')) {
      const parts = text.split(/(\*[^*]+\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          // Extract the text between * markers
          const italicText = part.slice(1, -1);
          return <em key={`${baseKey}-${i}`} className="italic">{italicText}</em>;
        }
        
        // Check for underline in remaining text
        if (part.includes('__')) {
          return processUnderline(part, `${baseKey}-${i}`);
        }
        return part;
      });
    }
    
    // If no italic, check for underline
    return processUnderline(text, baseKey);
  };
  
  // Process underline (__text__)
  const processUnderline = (text: string, baseKey: number | string) => {
    if (!text.includes('__')) return text;
    
    const parts = text.split(/(__[^_]+__)/g);
    return parts.map((part, i) => {
      if (part.startsWith('__') && part.endsWith('__') && part.length > 4) {
        // Extract the text between __ markers
        const underlineText = part.slice(2, -2);
        return <span key={`${baseKey}-${i}`} className="underline">{underlineText}</span>;
      }
      return part;
    });
  };

  // State for customization options
  const [backgroundColor, setBackgroundColor] = useState(note.backgroundColor || "#ffffff");
  const [fontSize, setFontSize] = useState(note.fontSize || "normal");
  
  // Font size options
  const fontSizeOptions = [
    { value: "small", label: "Small" },
    { value: "normal", label: "Normal" },
    { value: "large", label: "Large" },
    { value: "x-large", label: "Extra Large" },
  ];
  
  // Background color options with friendly names
  const backgroundColorOptions = [
    { value: "#ffffff", label: "White" },
    { value: "#f3f4f6", label: "Light Gray" },
    { value: "#fffbeb", label: "Warm Yellow" },
    { value: "#ecfdf5", label: "Mint Green" },
    { value: "#f0f9ff", label: "Sky Blue" },
    { value: "#fef2f2", label: "Soft Red" },
    { value: "#f5f3ff", label: "Lavender" },
  ];
  
  // Save customization settings
  const saveCustomizationMutation = useMutation({
    mutationFn: async () => {
      if (!noteId) return;
      return apiRequest("PUT", `/api/notes/${noteId}`, {
        ...note,
        backgroundColor,
        fontSize,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/notes/${noteId}`] });
      toast({
        title: "Customization saved",
        description: "Your note appearance settings have been updated.",
      });
    },
  });
  
  // Calculate styles based on font size
  const getFontSizeStyle = (size: string) => {
    switch(size) {
      case "small": return "text-sm";
      case "normal": return "text-base";
      case "large": return "text-lg";
      case "x-large": return "text-xl";
      default: return "text-base";
    }
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
        
        {/* Customization Controls */}
        <div className="mb-4 bg-gray-50 p-4 rounded-lg border">
          <h3 className="text-sm font-medium mb-3">Customize Note Appearance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
              <div className="flex space-x-2">
                {backgroundColorOptions.map(option => (
                  <button
                    key={option.value}
                    className={`w-8 h-8 rounded-full border ${backgroundColor === option.value ? 'ring-2 ring-primary' : 'ring-0'}`}
                    style={{ backgroundColor: option.value }}
                    onClick={() => setBackgroundColor(option.value)}
                    title={option.label}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
              <div className="flex flex-wrap gap-2">
                {fontSizeOptions.map(option => (
                  <button
                    key={option.value}
                    className={`px-3 py-1 rounded-md text-sm ${fontSize === option.value ? 'bg-primary text-white' : 'bg-gray-200 text-gray-800'}`}
                    onClick={() => setFontSize(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Button 
              onClick={() => saveCustomizationMutation.mutate()}
              disabled={saveCustomizationMutation.isPending}
              size="sm"
            >
              {saveCustomizationMutation.isPending ? "Saving..." : "Save Appearance"}
            </Button>
          </div>
        </div>
        
        <div 
          className="rounded-lg shadow-md p-6 mb-6"
          style={{ backgroundColor }}
        >
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">{note.title}</h2>
          <div className="text-sm text-gray-500 mb-4">
            Created {formatDistanceToNow(createdAt, { addSuffix: true })}
            {isUpdated && ` · Updated ${formatDistanceToNow(updatedAt, { addSuffix: true })}`}
          </div>
          <div className={`prose max-w-none mb-6 ${getFontSizeStyle(fontSize)}`}>
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
