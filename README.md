# CodeSplain

An intelligent web application that explains code snippets in simple, easy-to-understand language using AI. Built with React, Vite, and Node.js/Express.

## 🌟 Features

- **AI-Powered Explanations**: Get clear, human-readable explanations for any code snippet
- **Multi-Language Support**: Works with JavaScript, Python, Java, and more
- **Clean UI**: Modern, responsive interface built with React and Tailwind CSS
- **Fast Performance**: Powered by Vite for instant hot module replacement and optimized builds
- **RESTful API**: Backend built with Express.js for seamless frontend-backend communication

## 🚀 Tech Stack

### Frontend (`code-explainer/`)
- **React 19** – UI library
- **Vite** – Build tool and dev server
- **Tailwind CSS** – Styling
- **ESLint** – Code quality

### Backend (`Server/`)
- **Node.js** – Runtime environment
- **Express.js** – Web framework
- **REST API** – Backend communication

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Clone the Repository
```bash
git clone https://github.com/HarshaAnuga/Ai-codeExplainer.git
cd Ai-codeExplainer
```

### Setup Backend
```bash
cd Server
npm install
```

Create a `.env` file in the `Server/` directory with your API keys:
```env
YOUR_API_KEY=your_api_key_here
PORT=5000
```

### Setup Frontend
```bash
cd code-explainer
npm install
```

Create a `.env` file in the `code-explainer/` directory:
```env
VITE_API_URL=http://localhost:5000
```

## 🛠️ Usage

### Start the Backend Server
```bash
cd Server
npm start
```
The backend will run on `http://localhost:5000`

### Start the Frontend
```bash
cd code-explainer
npm run dev
```
The frontend will run on `http://localhost:5173`

### API Endpoints

**POST** `/api/explain`
- **Request Body**: `{ "code": "your code snippet here" }`
- **Response**: `{ "explanation": "AI-generated explanation" }`

## 📁 Project Structure

```
Ai-codeExplainer/
├── code-explainer/       # React frontend
│   ├── src/             # Source files
│   ├── public/          # Static assets
│   ├── index.html       # Entry HTML
│   ├── package.json     # Frontend dependencies
│   ├── vite.config.js   # Vite configuration
│   └── .env             # Frontend environment variables
├── Server/              # Node.js backend
│   ├── server.js        # Express server
│   ├── package.json     # Backend dependencies
│   └── .env             # Backend environment variables
└── README.md            # Project documentation
```

## 🔧 Configuration

### Environment Variables

**Frontend (.env)**
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |

**Backend (.env)**
| Variable | Description |
|----------|-------------|
| `YOUR_API_KEY` | Your AI API key |
| `PORT` | Server port (default: 5000) |

## 📝 Scripts

### Frontend
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

### Backend
| Command | Description |
|---------|-------------|
| `npm start` | Start the server |
| `npm run dev` | Start with hot reload (if configured) |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the MIT License.

## 👤 Author

**Harsha Anuga**  
[GitHub](https://github.com/HarshaAnuga)

## 🙏 Acknowledgments

- AI API provider for code explanation capabilities
- React and Vite communities for excellent tooling
- Express.js for the backend framework

---

<div align="center">
  <strong>Built with ❤️ using React, Vite, and Node.js</strong>
</div>
