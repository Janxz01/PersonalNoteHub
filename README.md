# AI-Powered Notes Application

A full-stack MERN (MongoDB, Express.js, React, Node.js) notes application with AI-powered features and a beautiful user interface.

## Features

- **User Authentication**: Secure registration and login system with JWT
- **CRUD Operations**: Create, read, update, and delete personal notes
- **AI-Powered Summaries**: Generate concise summaries of notes using OpenAI's GPT-4o
- **Customization Options**:
  - Background color themes for notes
  - Font size adjustment
  - Text formatting with markdown-style syntax
- **Organization Features**:
  - Note pinning for important notes
  - Archiving system for old notes
  - Labels/tags for categorization
  - Search functionality to quickly find notes
- **Note of the Day**: Inspirational quotes displayed on the home page
- **QR Code Scanning**: Scan a QR code to instantly create a note from its content
- **Responsive Design**: Works on mobile, tablet, and desktop devices

## Technologies Used

### Frontend
- React.js with TypeScript
- Tailwind CSS with shadcn/ui components
- Wouter for navigation
- TanStack Query for data fetching
- React Hook Form with Zod validation
- Lucide icons

### Backend
- Express.js API server
- JWT authentication
- In-memory storage (can be replaced with MongoDB)
- OpenAI API integration for AI features
- RESTful API design

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/ai-notes-app.git
   cd ai-notes-app
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up environment variables
   Create a `.env` file in the root directory and add:
   ```
   JWT_SECRET=your_jwt_secret
   OPENAI_API_KEY=your_openai_api_key
   ```

4. Start the development server
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5000`

## Project Structure

- `/client` - Frontend React application
  - `/src/components` - React components
  - `/src/pages` - Page components
  - `/src/hooks` - Custom React hooks
  - `/src/lib` - Utility functions
- `/server` - Backend Express API
  - `routes.ts` - API routes
  - `storage.ts` - Data storage operations
  - `openai.ts` - OpenAI API integration
- `/shared` - Shared TypeScript types and schemas

## License

MIT

## Acknowledgements

- OpenAI for the GPT API
- shadcn/ui for the component library
- HTML5-QRCode for QR code scanning functionality