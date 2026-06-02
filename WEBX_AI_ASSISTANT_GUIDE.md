# WebX-AI Assistant - Complete Implementation Guide

## Overview

**WebX-AI Assistant** is an intelligent, context-aware AI assistant built exclusively for the WebExcels DRM platform using OpenAI GPT-4.1. It provides screen-aware, role-aware assistance that evolves with your application.

## Key Features

### 🎯 **Exclusive Platform Scope**
- **Only** responds to queries about WebExcels DRM features, data, and workflows
- **Rejects** any questions about the outer world or general knowledge
- Maintains strict boundaries to ensure focused, relevant assistance

### 🧠 **Context Intelligence**

The assistant automatically detects and adapts to:

1. **Current Screen/Module** - Knows which page the user is viewing:
   - Dashboard
   - Customer Management
   - Sales Targets
   - Activity Tracker
   - PMS (Project Management)
   - Reports
   - Training Center
   - And more...

2. **User Role** - Provides role-appropriate insights:
   - Sales Executive
   - Assistant Manager
   - Manager
   - HOD (Head of Department)
   - Admin

3. **Screen Data** - Can analyze visible data on the current screen:
   - Customer metrics
   - Sales performance
   - Lead information
   - Task statuses
   - Any data passed via context

### 🚀 **Capabilities**

The assistant can:
- Explain features and functionality of any module
- Analyze visible data and provide insights
- Suggest next steps based on workflow context
- Help interpret metrics, targets, and performance data
- Guide through customer management workflows
- Explain commission structures and sales targets
- Assist with pool management (Private, Service, BV, Public)
- Provide activity tracking guidance
- Help with task and to-do prioritization
- Guide through training modules

## Technical Implementation

### Architecture

```
Frontend (React)
├── AIAssistantButton - Floating chat trigger
├── AIAssistantChat - Chat interface
└── AssistantContext - Tracks screen, role, and data

Backend (Express + OpenAI)
├── ai-assistant.ts - Core AI logic with GPT-4.1
├── ai-routes.ts - REST API endpoints
└── System Prompt Builder - Injects context dynamically
```

### How It Works

1. **Context Tracking**
   - `AssistantProvider` wraps the entire app
   - Automatically detects URL changes (current screen)
   - Stores user role, name, and screen-specific data
   - Components can update context via `setScreenData()`

2. **System Prompt Injection**
   - Every request builds a fresh system prompt
   - Includes: user role, current screen, permissions, screen data
   - Ensures responses are always contextually relevant

3. **Conversation Flow**
   ```
   User types message → Frontend sends:
   - Message text
   - Current context (screen, role, data)
   - Conversation history
   
   Backend:
   - Builds system prompt with context
   - Calls OpenAI GPT-4.1
   - Returns AI response
   
   Frontend:
   - Displays response in chat
   - Maintains conversation history
   ```

## Usage

### For Users

1. **Open Assistant**
   - Click the green floating button (Sparkles icon) in bottom-right corner

2. **Ask Questions**
   - "What do these metrics mean?"
   - "How do I achieve my sales target?"
   - "Which customers need follow-up today?"
   - "Explain the commission slabs"
   - "What's the difference between Private and Service pools?"

3. **Context-Aware Responses**
   - On Dashboard: Gets insights about visible metrics
   - On Customer List: Helps analyze lead grades and stages
   - On Activity Tracker: Suggests time management improvements
   - On Reports: Explains data trends and patterns

### For Developers

#### Adding Screen Data

```typescript
import { useAssistant } from "@/contexts/assistant-context";

function MyComponent() {
  const { setScreenData } = useAssistant();
  
  // Update context when data loads
  useEffect(() => {
    setScreenData({
      totalCustomers: 1248,
      newLeads: 42,
      expiringRenewals: 14,
      // Any relevant data...
    });
  }, []);
}
```

#### Updating User Role/Name

```typescript
const { setUserRole, setUserName } = useAssistant();

setUserRole("Manager");
setUserName("Jane Smith");
```

## Evolution & Scalability

### Auto-Adaptation

The assistant automatically adapts when you:
- Add new screens/modules (update `getScreenContext()` mapping)
- Add new user roles (update `getRoleCapabilities()`)
- Change features (reflected in system prompt)

### Adding New Screens

Edit `server/ai-assistant.ts`:

```typescript
export function getScreenContext(screenPath: string): string {
  const screenMap: Record<string, string> = {
    // ... existing screens
    "/new-module": "New Module - Description of what this screen does",
  };
  return screenMap[screenPath] || "Unknown Screen";
}
```

### Adding New Roles

Edit `getRoleCapabilities()` in `server/ai-assistant.ts`:

```typescript
const capabilities: Record<UserRole, string> = {
  // ... existing roles
  "New Role": `Description of this role's capabilities and access...`,
};
```

## API Integration

### Environment Variables
- `OPENAI_API_KEY` (required)
- `OPENAI_BASE_URL` (optional)

### Cost & Billing
- Uses your configured OpenAI account (or proxy provider) for billing.
- Uses the `gpt-4.1` model by default (see `server/ai-assistant.ts`).

## API Endpoint

### POST /api/ai/chat

**Request:**
```json
{
  "message": "User's question",
  "context": {
    "currentScreen": "/",
    "userRole": "Sales Executive",
    "userName": "John Doe",
    "screenData": { /* optional screen-specific data */ }
  },
  "conversationHistory": [ /* optional previous messages */ ]
}
```

**Response:**
```json
{
  "success": true,
  "response": "AI assistant's response",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

## Security & Boundaries

### Built-in Protections

1. **Scope Enforcement**
   - System prompt explicitly restricts to WebExcels DRM only
   - Rejects out-of-scope queries with polite redirect

2. **Role-Based Responses**
   - Provides information appropriate to user's role
   - Mentions role-specific features and permissions

3. **Data Privacy**
   - Only processes data explicitly passed in context
   - No persistent storage of conversation history
   - Each session is independent

## Testing the Assistant

Try these example queries:

**General:**
- "What can you help me with?"
- "Tell me about the weather" (should be rejected)

**Dashboard:**
- "What do my numbers mean?"
- "How close am I to my target?"
- "Which metric needs my attention?"

**Customer Management:**
- "What's an A+ grade customer?"
- "When should I follow up with leads?"
- "Explain the project stages"

**Sales Targets:**
- "How does the commission structure work?"
- "What happens if I hit $50k this month?"
- "Show me my progress toward quarterly goals"

## Future Enhancements

Potential additions:
- Multi-turn conversations with memory
- Proactive suggestions based on patterns
- Integration with workflow automation
- Voice input/output
- Export chat history
- Custom training on company-specific processes

---

## Quick Reference

**Float Button Location:** Bottom-right corner
**Icon:** Green sparkles ✨
**Shortcut:** Click anywhere to open/close

**Remember:** WebX-AI only knows about WebExcels DRM. It's your expert guide within this platform!
