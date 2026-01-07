# Collede AI Gateway

Collede is a professional AI gateway designed to provide a unified, OpenAI-compatible interface for multiple LLM providers. It includes an administrative dashboard for model management, secure user authentication, and an interactive playground.

## Features

- Unified API: Standardized OpenAI-compatible endpoints for all integrated providers.
- Admin Dashboard: Centralized control for API configurations and model inventory.
- Model Management: Sync and toggle specific models on or off for end-users.
- Secure Authentication: Integrated session management for user access control.
- Interactive Playground: Real-time testing environment for active models.
- Professional Documentation: Built-in API reference and SDK examples.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in a .env file:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
   CLERK_SECRET_KEY=your_secret_key
   ADMIN_EMAIL=your_admin_email
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Access the application:
   - Landing Page: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin
   - Documentation: http://localhost:3000/docs

## Zeabur Deployment

Collede is designed for seamless deployment on Zeabur.

1. Create a new project in Zeabur.
2. Connect your GitHub repository.
3. Configure the following Environment Variables in the Zeabur dashboard:
   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   - CLERK_SECRET_KEY
   - ADMIN_EMAIL
   - PORT (Defaults to 3000)
4. Zeabur will automatically detect the Node.js environment and start the server using the `npm start` command.

## Data Persistence

The gateway uses local file storage for configurations and model data. When deploying to Zeabur, ensure that the /data directory is handled correctly if you require persistent storage across redeployments, or use the administrative dashboard to reconfigure settings as needed.

## API Usage

Authentication is handled via session tokens. Include your token in the Authorization header for all API requests:

```bash
Authorization: Bearer YOUR_SESSION_TOKEN
```

Base URL for all requests: `https://your-deployment-url.zeabur.app/v1`
