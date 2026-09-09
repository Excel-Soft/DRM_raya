import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { User, UserCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Todo {
  id: number;
  task: string;
  completed: boolean;
  origin: "self" | "manager";
}

//todo: remove mock functionality
const initialTodos: Todo[] = [
  { id: 1, task: "Follow up with Acme Corp regarding payment", completed: false, origin: "self" },
  { id: 2, task: "Prepare quarterly sales report", completed: false, origin: "manager" },
  { id: 3, task: "Update customer grades in system", completed: true, origin: "self" },
  { id: 4, task: "Schedule training session for new leads", completed: false, origin: "manager" },
  { id: 5, task: "Review VAS performance metrics", completed: true, origin: "self" },
];

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
    console.log("Todo toggled:", id);
  };

  const pendingCount = todos.filter(t => !t.completed).length;

  return (
    <Card data-testid="card-todo-list">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>To-Do List</CardTitle>
          <Badge variant="secondary">{pendingCount} pending</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-md hover-elevate",
                todo.completed && "opacity-60"
              )}
              data-testid={`todo-${todo.id}`}
            >
              <Checkbox
                checked={todo.completed}
                onCheckedChange={() => toggleTodo(todo.id)}
                data-testid={`checkbox-todo-${todo.id}`}
                className="mt-1"
              />
              <div className="flex-1 space-y-1">
                <p className={cn("text-sm", todo.completed && "line-through")}>
                  {todo.task}
                </p>
                <div className="flex items-center gap-2">
                  {todo.origin === "manager" ? (
                    <Badge variant="outline" className="text-xs gap-1">
                      <UserCheck className="w-3 h-3" />
                      Assigned by Manager
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <User className="w-3 h-3" />
                      Self-assigned
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
