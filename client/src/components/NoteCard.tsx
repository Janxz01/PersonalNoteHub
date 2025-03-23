import { formatDistanceToNow } from "date-fns";
import { Note } from "@shared/schema";
import { Edit2Icon, Trash2Icon, ZapIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

  // Format timestamp
  const formattedDate = formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true });

  return (
    <div 
      className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border border-gray-200 w-full" // Added w-full for responsiveness
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-lg text-gray-900">{note.title}</h3>
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