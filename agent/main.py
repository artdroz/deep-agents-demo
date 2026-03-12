"""main.py

FastAPI server for the demo agent.

This server exposes an AG-UI endpoint used by the Next.js frontend.
The agent supports multiple modes via AGENT_MODE:

- research (default)
- coding

Tool-call emission is configured per-mode to avoid leaking internal subagent
noise into the chat UI.
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from copilotkit.langgraph import copilotkit_customize_config

from agent import build_agent

load_dotenv()

app = FastAPI(
    title="Deep Agents Demo",
    description="A demo agent powered by Deep Agents and CopilotKit",
    version="1.0.0",
)

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "deep-agents-demo-agent",
        "version": "1.0.0",
        "mode": (os.environ.get("AGENT_MODE") or "research"),
    }


def _agent_mode() -> str:
    mode = (os.environ.get("AGENT_MODE") or "research").strip().lower()
    return "coding" if mode == "coding" else "research"


# Build and register the agent
try:
    agent_graph = build_agent()

    mode = _agent_mode()

    # Configure which tool calls to emit to the frontend.
    # In research mode, suppress internal subagent noise (internet_search).
    # In coding mode, emit the core workspace tools.
    if mode == "coding":
        emit_tool_calls = [
            "execute_command",
            "list_directory",
            "read_file",
            "write_file",
            "edit_file",
            "write_todos",
            "research",
        ]
    else:
        emit_tool_calls = [
            "research",
            "write_todos",
            "write_file",
            "read_file",
            "edit_file",
        ]

    agui_config = copilotkit_customize_config(emit_tool_calls=emit_tool_calls)
    agui_config["recursion_limit"] = 100

    add_langgraph_fastapi_endpoint(
        app=app,
        agent=LangGraphAGUIAgent(
            name="deep_agents_demo",
            description="A demo agent that can run in research or coding mode",
            graph=agent_graph,
            config=agui_config,
        ),
        path="/",
    )

    print(f"[SERVER] Agent registered at / (mode={mode})")
except Exception as e:
    print(f"[ERROR] Failed to build agent: {e}")
    raise


def main():
    import uvicorn

    host = os.getenv("SERVER_HOST", "0.0.0.0")
    port = int(os.getenv("SERVER_PORT", "8123"))

    print(f"[SERVER] Starting on {host}:{port}")
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()
