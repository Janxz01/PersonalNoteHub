import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Summarizes note content using OpenAI's GPT-4o model
 * @param text The note content to summarize
 * @returns A concise summary of the note content
 */
export async function summarizeNote(text: string): Promise<string> {
  try {
    const prompt = `Please summarize the following note concisely while maintaining key points and important information:\n\n${text}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates concise summaries of notes. Extract the most important points and create a brief summary with no more than 100 words."
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      max_tokens: 200,
    });

    return response.choices[0].message.content || "Failed to generate summary";
  } catch (error) {
    console.error("Error generating summary with OpenAI:", error);
    throw new Error("Failed to generate summary");
  }
}
