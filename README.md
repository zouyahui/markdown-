# WinMD Explorer

WinMD Explorer is a modern, Windows 11-styled Markdown editor and file explorer built with Electron and React. It features a sleek dark mode interface, tabbed navigation, and powerful AI capabilities powered by Google Gemini.

![WinMD Explorer Screenshot](https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f4c1.png)

## Features

- **🪟 Windows 11 Aesthetic**: Designed to look and feel native on modern Windows systems.
- **📑 Tabbed Interface**: Open and edit multiple files simultaneously.
- **✨ AI-Powered**: Built-in integration with **Google Gemini 3.0** for document summarization, Q&A, and chat.
- **↔️ Resizable Layout**: Fully adjustable sidebar and AI assistant panels to customize your workspace.
- **📝 Professional Editor**: Powered by **Monaco Editor** (the core of VS Code) for a top-tier writing experience.
- **👁️ Live Preview**: Instant Markdown rendering with support for:
  - **Mermaid Diagrams**: Create flowcharts and diagrams.
  - **Math (KaTeX)**: Render complex mathematical equations.
  - **Syntax Highlighting**: Prism-based highlighting for code blocks.
  - **GFM**: Tables, task lists, and more.
- **🔄 Synchronized Scrolling**: Editor and preview panes scroll together.
- **💾 Native File System**: Open, edit, and save files directly to your hard drive.

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/winmd-explorer.git
   cd winmd-explorer
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

### Running Locally

To start the application in development mode:

```bash
npm start
```

This will launch the Electron window with the React application running inside.

### Building for Production

To create a distributable installer/executable for your platform (Windows, macOS, or Linux):

```bash
npm run make
```

The output files will be located in the `out/` directory.

## Configuration

### AI Features

To use the AI features (Chat, Summarization), you need a Google Gemini API Key.
1. Get a free key from [Google AI Studio](https://aistudio.google.com/).
2. Click the **Settings (Gear)** icon in the app sidebar.
3. Paste your API key. Keys are stored locally on your device.

## Tech Stack

- **Electron**: Desktop runtime.
- **React**: UI library.
- **Tailwind CSS**: Styling.
- **Monaco Editor**: Code editing component.
- **Google GenAI SDK**: AI integration.
- **React Markdown / Remark / Rehype**: Markdown rendering pipeline.
- **Lucide React**: Iconography.

## License

MIT