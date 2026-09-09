// Session memory system for tracking recent conversations and actions
interface SessionAction {
  type: 'conversation' | 'navigation' | 'data_change';
  timestamp: Date;
  data: any;
}

class SessionMemory {
  private actions: SessionAction[] = [];
  private maxActions = 50;

  addConversation(userMessage: string, assistantResponse: string) {
    this.actions.push({
      type: 'conversation',
      timestamp: new Date(),
      data: { userMessage, assistantResponse },
    });
    this.cleanup();
  }

  addNavigation(fromScreen: string, toScreen: string) {
    this.actions.push({
      type: 'navigation',
      timestamp: new Date(),
      data: { fromScreen, toScreen },
    });
    this.cleanup();
  }

  addDataChange(screenPath: string, dataType: string, summary: string) {
    this.actions.push({
      type: 'data_change',
      timestamp: new Date(),
      data: { screenPath, dataType, summary },
    });
    this.cleanup();
  }

  getRecentActions(count: number = 10): SessionAction[] {
    return this.actions.slice(-count);
  }

  getRecentConversations(count: number = 5): Array<{userMessage: string, assistantResponse: string}> {
    return this.actions
      .filter(action => action.type === 'conversation')
      .slice(-count)
      .map(action => action.data);
  }

  getSessionSummary(): string {
    const recentScreens = this.actions
      .filter(action => action.type === 'navigation')
      .slice(-5)
      .map(action => action.data.toScreen);

    const uniqueScreens = Array.from(new Set(recentScreens));
    
    if (uniqueScreens.length === 0) {
      return "This is a new session.";
    }

    return `Recent activity: Visited ${uniqueScreens.join(', ')} in this session.`;
  }

  private cleanup() {
    if (this.actions.length > this.maxActions) {
      this.actions = this.actions.slice(-this.maxActions);
    }
  }

  clear() {
    this.actions = [];
  }
}

export const sessionMemory = new SessionMemory();
