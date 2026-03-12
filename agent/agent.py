"""agent.py

Supports two modes:
- research (default): original Deep Research Assistant behavior
- coding: enables filesystem + shell tools for IDE-like coding workflows
"""

import os

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from deepagents import create_deep_agent
from deepagents.middleware.filesystem import FilesystemMiddleware
from langgraph.checkpoint.memory import MemorySaver
from copilotkit import CopilotKitMiddleware

from tools import research

load_dotenv()


RESEARCH_SYSTEM_PROMPT = """You are a Deep Research Assistant, an expert at planning and
executing comprehensive research on any topic.

Hard rules (ALWAYS follow):
- NEVER output raw JSON, data structures, or code blocks in your messages
- Communicate with the user only in natural, readable prose
- When you receive data from research, synthesize it into insights

Your workflow:
1. PLAN: Create a research plan using write_todos with clear, actionable steps
2. RESEARCH: Use research(query) tool to investigate each topic
3. SYNTHESIZE: Write a final report to /reports/final_report.md using write_file

Important guidelines:
- Always start by creating a research plan with write_todos
- Call research() for each distinct research question
- The research tool returns prose summaries of findings
- You write all files - compile findings into a comprehensive report
- Update todos as you complete each step

Example workflow:
1. write_todos(["Research topic A", "Research topic B", "Synthesize findings"])
2. research("Find information about topic A") -> receives prose summary
3. research("Find information about topic B") -> receives prose summary
4. write_file("/reports/final_report.md", "# Research Report\n\n...")

Always maintain a professional, comprehensive research style."""


CODING_SYSTEM_PROMPT = """You are Deep Agents IDE, a senior software engineering agent.

Hard rules (ALWAYS follow):
- Prefer using tools over guessing. Inspect files with read_file, list directories with ls.
- Make small, safe changes and keep the codebase consistent.
- After modifying code, run relevant commands with execute (tests/build/lint).
- Communicate in clear prose; do not dump large raw logs unless asked.

Workflow:
1. Understand the request and inspect the repo.
2. Plan with todos.
3. Implement using filesystem tools (read_file/write_file/edit_file) and execute for shell commands.
4. Verify by running checks.
5. Summarize what changed and why.

You may use the research() tool to look things up when needed."""


def build_agent():
    """Build the Deep Agents graph with CopilotKit integration."""

    agent_mode = os.environ.get("AGENT_MODE", "research").strip().lower()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY environment variable")

    # Only require Tavily in research mode. In coding mode, research() remains
    # available but optional; it will still need TAVILY_API_KEY at call-time.
    if agent_mode == "research":
        tavily_key = os.environ.get("TAVILY_API_KEY")
        if not tavily_key:
            raise RuntimeError("Missing TAVILY_API_KEY environment variable")

    # Initialize LLM - use model from env or default to gpt-5.2
    model_name = os.environ.get("OPENAI_MODEL", "gpt-5.2")
    llm = ChatOpenAI(
        model=model_name,
        temperature=0.7,
        api_key=api_key,
    )

    # Keep research tool available in both modes.
    main_tools = [research]

    system_prompt = RESEARCH_SYSTEM_PROMPT
    middleware = [CopilotKitMiddleware()]

    if agent_mode == "coding":
        # Adds ls/read_file/write_file/edit_file/glob/grep and execute (when supported)
        system_prompt = CODING_SYSTEM_PROMPT
        middleware = [FilesystemMiddleware(), CopilotKitMiddleware()]

    agent_graph = create_deep_agent(
        model=llm,
        system_prompt=system_prompt,
        tools=main_tools,
        middleware=middleware,
        checkpointer=MemorySaver(),
    )

    print(f"[AGENT] Agent created with mode={agent_mode}, model={model_name}")
    print(f"[AGENT] Main tools: {[t.name for t in main_tools]}")

    # Configure recursion limit for complex tasks
    return agent_graph.with_config({"recursion_limit": 100})
