import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Quote {
  text: string;
  author: string;
}

// Array of inspirational quotes
const inspirationalQuotes: Quote[] = [
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs"
  },
  {
    text: "Believe you can and you're halfway there.",
    author: "Theodore Roosevelt"
  },
  {
    text: "It does not matter how slowly you go as long as you do not stop.",
    author: "Confucius"
  },
  {
    text: "The future belongs to those who believe in the beauty of their dreams.",
    author: "Eleanor Roosevelt"
  },
  {
    text: "Success is not final, failure is not fatal: It is the courage to continue that counts.",
    author: "Winston Churchill"
  },
  {
    text: "It always seems impossible until it's done.",
    author: "Nelson Mandela"
  },
  {
    text: "The best way to predict the future is to create it.",
    author: "Peter Drucker"
  },
  {
    text: "Your time is limited, don't waste it living someone else's life.",
    author: "Steve Jobs"
  },
];

// Get a random quote from the array
const getRandomQuote = (): Quote => {
  const randomIndex = Math.floor(Math.random() * inspirationalQuotes.length);
  return inspirationalQuotes[randomIndex];
};

export default function NoteOfTheDay() {
  const [quote, setQuote] = useState<Quote | null>(null);

  // Fetch quote when component mounts
  useEffect(() => {
    // Try to get a quote from local storage first (to maintain the daily quote)
    const savedQuote = localStorage.getItem('dailyQuote');
    const savedDate = localStorage.getItem('dailyQuoteDate');
    const today = new Date().toDateString();
    
    if (savedQuote && savedDate === today) {
      // If we have a quote saved from today, use it
      setQuote(JSON.parse(savedQuote));
    } else {
      // Otherwise, get a new quote
      const newQuote = getRandomQuote();
      setQuote(newQuote);
      
      // Save the new quote and today's date
      localStorage.setItem('dailyQuote', JSON.stringify(newQuote));
      localStorage.setItem('dailyQuoteDate', today);
    }
  }, []);

  // Handle refreshing the quote
  const handleRefreshQuote = () => {
    const newQuote = getRandomQuote();
    setQuote(newQuote);
    localStorage.setItem('dailyQuote', JSON.stringify(newQuote));
    localStorage.setItem('dailyQuoteDate', new Date().toDateString());
  };

  if (!quote) {
    return (
      <Card className="w-full bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="flex justify-center items-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-gradient-to-r from-primary/10 to-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Lightbulb className="h-5 w-5 mr-2 text-primary" />
          Note of the Day
        </CardTitle>
        <CardDescription>
          Daily inspiration for your notes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <blockquote className="italic text-lg border-l-4 border-primary/50 pl-4 py-2">
          "{quote.text}"
        </blockquote>
        <p className="text-right font-semibold mt-2">— {quote.author}</p>
      </CardContent>
      <CardFooter className="justify-end">
        <Button variant="ghost" size="sm" onClick={handleRefreshQuote}>
          New inspiration
        </Button>
      </CardFooter>
    </Card>
  );
}