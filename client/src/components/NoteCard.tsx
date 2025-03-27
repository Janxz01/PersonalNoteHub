import { formatDistanceToNow } from "date-fns";
import { Note } from "@shared/schema";
import { Edit2Icon, Trash2Icon, ZapIcon, PinIcon, ArchiveIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface NoteCardProps {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}

export default function NoteCard({ note, onEdit, onDelete, onClick }: NoteCardProps) {
  const { toast } = useToast();

  // Generate AI summary mutation
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/notes/${note.id}/summary`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/notes/${note.id}`] });
      toast({
        title: "Summary generated",
        description: "AI summary has been created for your note.",
      });
    },
  });
  
  // Toggle pin mutation
  const togglePinMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/notes/${note.id}/pin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/notes/${note.id}`] });
      toast({
        title: note.pinned ? "Note unpinned" : "Note pinned",
        description: note.pinned ? "The note has been unpinned." : "The note has been pinned to the top.",
      });
    },
  });
  
  // Toggle archive mutation
  const toggleArchiveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/notes/${note.id}/archive`);
    },
    onSuccess: () => {
      // Invalidate all note queries to update lists completely
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      
      // Invalidate both archived=true and archived=false queries to ensure lists update correctly
      queryClient.invalidateQueries({ queryKey: ["/api/notes", { archived: true }] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", { archived: false }] });
      
      // Invalidate single note view
      queryClient.invalidateQueries({ queryKey: [`/api/notes/${note.id}`] });
      
      toast({
        title: note.archived ? "Note restored" : "Note archived",
        description: note.archived 
          ? "The note has been moved back to active notes." 
          : "The note has been archived.",
      });
    },
  });

  // Handle generate summary button click
  const handleGenerateSummary = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    generateSummaryMutation.mutate();
  };

  // Handle edit button click
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onEdit();
  };

  // Handle delete button click
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onDelete();
  };
  
  // Handle pin toggle
  const handlePinToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    togglePinMutation.mutate();
  };
  
  // Handle archive toggle
  const handleArchiveToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    toggleArchiveMutation.mutate();
  };

  // Format timestamp
  const formattedDate = note.updatedAt 
    ? formatDistanceToNow(new Date(note.updatedAt.toString()), { addSuffix: true })
    : "";

  return (
    <div 
      className={cn(
        "p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border w-full min-h-[200px] flex flex-col justify-between",
        note.pinned 
          ? "bg-primary/5 border-primary/30" 
          : note.archived
            ? "bg-amber-50/30 border-amber-200"
            : "bg-card border-border"
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          {note.pinned && (
            <div className="text-primary" title="Pinned note">
              <PinIcon className="h-4 w-4" />
            </div>
          )}
          <h3 className="font-medium text-lg text-gray-900">{note.title}</h3>
        </div>
        <div className="text-xs text-gray-500">{formattedDate}</div>
      </div>
      <p className="text-gray-600 text-sm line-clamp-3 mb-3">{note.content}</p>
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          <button 
            className="text-gray-500 hover:text-primary"
            onClick={handleEdit}
            aria-label="Edit note"
          >
            <Edit2Icon className="h-4 w-4" />
          </button>
          <button 
            className={cn(
              "hover:text-primary",
              note.pinned ? "text-primary" : "text-gray-500"
            )}
            onClick={handlePinToggle}
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            disabled={togglePinMutation.isPending}
            title={note.pinned ? "Unpin note" : "Pin note"}
          >
            <PinIcon className="h-4 w-4" />
          </button>
          <button 
            className={cn(
              "hover:text-amber-500",
              note.archived ? "text-amber-500" : "text-gray-500"
            )}
            onClick={handleArchiveToggle}
            aria-label={note.archived ? "Restore note" : "Archive note"}
            disabled={toggleArchiveMutation.isPending}
            title={note.archived ? "Restore note" : "Archive note"}
          >
            <ArchiveIcon className="h-4 w-4" />
          </button>
          <button 
            className="text-gray-500 hover:text-destructive"
            onClick={handleDelete}
            aria-label="Delete note"
          >
            <Trash2Icon className="h-4 w-4" />
          </button>
        </div>
        {note.summary ? (
          <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center">
            <ZapIcon className="h-3 w-3 mr-1" /> AI Summary
          </div>
        ) : (
          <button 
            className="text-xs text-primary hover:text-primary/90 font-medium"
            onClick={handleGenerateSummary}
            disabled={generateSummaryMutation.isPending}
          >
            {generateSummaryMutation.isPending ? "Generating..." : "Generate AI Summary"}
          </button>
        )}
      </div>
    </div>
  );
}