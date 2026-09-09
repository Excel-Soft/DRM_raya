import OpenAI from "openai";
import { getAnalyticalGuidance } from "./ai-analytics";

function createOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;

  if (!apiKey) {
    throw new Error("Missing OpenAI credentials. Set OPENAI_API_KEY to enable AI.");
  }

  return new OpenAI({ baseURL, apiKey });
}

export type UserRole = "Sales Executive" | "Assistant Manager" | "Manager" | "HOD" | "Admin";

export interface AssistantContext {
  currentScreen: string;
  userRole: UserRole;
  screenData?: Record<string, any>;
  userName?: string;
}

function buildSystemPrompt(context: AssistantContext): string {
  const screenName = getScreenContext(context.currentScreen);
  const screenDataJson = context.screenData && Object.keys(context.screenData).length > 0
    ? JSON.stringify(context.screenData, null, 2)
    : "No screen data available";
  
  const roleCapabilities = getRoleCapabilities(context.userRole);
  const analyticalGuidance = getAnalyticalGuidance(context);

  return `You are WebX-AI, a smart internal assistant for WebExcels DRM. The user is ${context.userName || 'a user'} with role: ${context.userRole}, currently viewing the ${screenName} screen.

=== YOUR CORE RESPONSIBILITIES ===
1. **Analyze visible data** and provide actionable insights
2. **Identify priorities** based on urgency, impact, and user role
3. **Suggest next steps** that align with WebExcels DRM workflows
4. **Answer questions** only about WebExcels DRM features and visible data
5. **Reject politely** any questions outside WebExcels DRM context

=== USER'S ROLE CAPABILITIES ===
${roleCapabilities}

=== CURRENT SCREEN DATA ===
${screenDataJson}

=== ANALYTICAL GUIDANCE ===
${analyticalGuidance}

=== RESPONSE STYLE ===
- **Be concise** - Get to the point quickly
- **Be specific** - Reference actual numbers and data points
- **Be actionable** - Always suggest what to do next
- **Be contextual** - Tailor advice to the user's role
- **Be helpful** - Anticipate follow-up questions

=== STRICT BOUNDARIES ===
If asked about anything outside WebExcels DRM (weather, general knowledge, external services, etc.), respond:
"I'm designed to assist only within WebExcels DRM. Please ask something related to your current workspace or tasks."

=== CONVERSATION MEMORY ===
You can reference earlier parts of this conversation to maintain context and avoid repetition.`;
}

function getRoleCapabilities(role: UserRole): string {
  const capabilities: Record<UserRole, string> = {
    "Sales Executive": `As a Sales Executive, you have access to:
- Dashboard with personal metrics and targets
- Customer management and follow-up tracking
- Activity logging and reporting
- Lead pools (Private, Service, Public)
- Sales target tracking for Alibaba & VAS
- To-do list management
- Training resources`,
    
    "Assistant Manager": `As an Assistant Manager, you have access to:
- All Sales Executive features
- Team performance overview
- Lead assignment and distribution
- Task assignment to team members
- Performance monitoring of sales executives`,
    
    "Manager": `As a Manager, you have access to:
- All Assistant Manager features
- Department-wide analytics
- Advanced reporting tools
- Approval workflows (overtime, loans)
- Team productivity metrics`,
    
    "HOD": `As Head of Department, you have access to:
- All Manager features
- Cross-department analytics
- Strategic planning tools
- Resource allocation oversight
- High-level performance dashboards`,
    
    "Admin": `As Admin, you have full system access:
- All user management features
- System configuration
- Public pool management
- Global analytics and reports
- All approval workflows
- Data management tools`,
  };
  
  return capabilities[role] || capabilities["Sales Executive"];
}

export async function generateAssistantResponse(
  context: AssistantContext,
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<string> {
  try {
    const openai = createOpenAI();
    const systemPrompt = buildSystemPrompt(context);
    
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: userMessage },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4.1", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages,
      max_completion_tokens: 1000,
      temperature: 0.3, // Consistent and deterministic responses
    });

    return response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("AI Assistant Error:", error);
    throw new Error("Failed to generate assistant response");
  }
}

// Context detection helpers for different screens
export function getScreenContext(screenPath: string): string {
  const screenMap: Record<string, string> = {
    "/": "Dashboard - Main overview with metrics, targets, and activity summary",
    "/attendance": "Attendance & Leave Tracker - View and manage attendance records",
    "/loan-request": "Loan Request - Submit and track loan applications",
    "/customers/duplicate-check": "Duplicate Check - Verify customer uniqueness before adding",
    "/customers/add": "Add Customer - Create new customer records",
    "/customers/temp": "Temporary Contacts - Manage temporary or unverified contacts",
    "/customers/private-pool": "Private Pool - Your personal lead collection",
    "/customers/service-pool": "Service Pool - Shared service leads",
    "/customers/gm-pool": "GM Pool - General Manager assigned leads",
    "/pms/tasks": "PMS Task Creation - Create and assign project tasks",
    "/pms/status": "PMS Project Status - Monitor project progress",
    "/workspace": "Workspace - Personal workspace and task management",
    "/reports/loan": "Loan Reports - Financial loan analytics",
    "/reports/vas": "VAS Reports - Value-Added Services performance",
    "/reports/gm": "GM Reports - General Manager metrics",
    "/reports/bv": "BV Reports - Business Verification analytics",
    "/training/drm": "DRM Training - Learn the Data Relation Management system",
    "/training/seo": "SEO Training - Search Engine Optimization courses",
    "/training/alibaba": "Alibaba Training - Alibaba platform training",
  };
  
  return screenMap[screenPath] || "Unknown Screen";
}
