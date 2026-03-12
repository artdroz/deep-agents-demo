"use client";

import { useState, useRef } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { useDefaultTool } from "@copilotkit/react-core";
import { Workspace } from "@/components/Workspace";
import { ResearchState, INITIAL_STATE, Todo } from "@/types/research";
import { ToolCard } from "@/components/ToolCard";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

export default function Page() {
  const [state, setState] = useState<ResearchState>(INITIAL_STATE);
  const processedKeysRef = useRef<Set<string>>(new Set());

  useDefaultTool({
    render: (props) => {
      const { name, status, args, result } = props;

      // Prevent duplicate processing on re-renders
      if (status === "complete") {
        const resultStr = result ? JSON.stringify(result) : "";
        const resultHash = resultStr ? `${resultStr.length}-${resultStr.slice(0, 100)}` : "";
        const key = `${name}-${JSON.stringify(args)}-${resultHash}`;
        if (processedKeysRef.current.has(key)) {
          return <ToolCard {...props} />;
        }
        processedKeysRef.current.add(key);
      }

      // Handle research tool - track summary and sources
      if (name === "research" && status === "complete" && result) {
        const researchResult = result as { summary: string; sources: Array<{url: string, title: string, content?: string, status: "found" | "scraped" | "failed"}> };

        // Track sources in state
        if (researchResult.sources && researchResult.sources.length > 0) {
          queueMicrotask(() => setState(prev => ({
            ...prev,
            sources: [...prev.sources, ...researchResult.sources]
          })));
        }

        console.log(`[UI] Research completed: ${researchResult.sources?.length || 0} sources found`);
      }

      // Handle write_todos tool
      if (name === "write_todos" && status === "complete" && args?.todos) {
        const todosWithIds = (args.todos as Array<{ id?: string; content: string; status: string }>).map(
          (todo, index) => ({
            ...todo,
            id: todo.id || `todo-${Date.now()}-${index}`,
          })
        );
        queueMicrotask(() => setState(prev => ({ ...prev, todos: todosWithIds as Todo[] })));
      }

      // Handle write_file tool
      // Deep Agents uses file_path (not path) as the parameter name
      if (name === "write_file" && status === "complete" && args?.file_path) {
        queueMicrotask(() => setState(prev => ({
          ...prev,
          files: [...prev.files, { path: args.file_path as string, content: args.content as string, createdAt: new Date().toISOString() }]
        })));
      }

      return <ToolCard {...props} />;
    },
  });

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <main className="h-screen overflow-hidden">
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={38} minSize={25} className="min-w-[280px]">
            <div className="h-full flex flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)] overflow-hidden">
              <header className="ide-header">
                <div className="flex items-center justify-between">
                  <h1 className="ide-title">Deep Agents IDE</h1>
                </div>
                <p className="ide-subtitle">Chat + tools, VS Code-inspired layout</p>
              </header>

              <div className="flex-1 min-h-0 overflow-hidden p-4">
                <CopilotChat
                  className="h-full"
                  labels={{
                    title: "Deep Agents IDE",
                    initial: "What would you like to work on?",
                    placeholder: "Ask me to implement, refactor, or investigate...",
                  }}
                />
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="ide-resize-handle" />

          <Panel defaultSize={62} minSize={35}>
            <div className="h-full overflow-hidden">
              <Workspace state={state} />
            </div>
          </Panel>
        </PanelGroup>
      </main>
    </div>
  );
}
