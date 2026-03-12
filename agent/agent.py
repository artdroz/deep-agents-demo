"""agent.py

Builds the Deep Agents LangGraph for this demo.

This project supports two modes, selected via the AGENT_MODE env var:

- research (default): research assistant behavior
- coding: coding agent behavior with shell/filesystem tools enabled

Notes:
- The Deep Agents SDK provides a standard set of built-in tools (e.g. read_file,
  write_file, edit_file, list_directory, execute_command, write_todos). In coding
  mode, we rely on those built-ins and keep the custom `research` tool available
  as an optional capability.
"""

import os

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from deepagents import create_deep_agent
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


CODING_SYSTEM_PROMPT = """You are Deep Agents IDE, a senior software engineer operating inside a coding workspace.

Hard rules (ALWAYS follow):
- NEVER output raw JSON, data structures, or code blocks in your messages
- Communicate with the user only in natural, readable prose
- Prefer making changes by reading relevant files, then writing minimal diffs

Your workflow:
1. PLAN: Create actionable todos using write_todos
2. INSPECT: Use list_directory and read_file to understand the codebase
3. IMPLEMENT: Use write_file / edit_file to make changes
4. VERIFY: Use execute_command to run format/lint/tests where available
5. REPORT: Summarize what changed and what to do next

Guidelines:
- Use execute_command for git/status/grep/tests when helpful
- Keep changes small and focused; don't refactor unrelated code
- Keep the research tool available for quick lookups, but prioritize local code inspection
"""


def _get_agent_mode() -> str:
    mode = (os.environ.get("AGENT_MODE") or "research").strip().lower()
    return "coding" if mode == "coding" else "research"


def build_agent():
    """Build the Deep Agent with CopilotKit integration."""

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY environment variable")

    mode = _get_agent_mode()

    # Tavily is only required for research mode.
    if mode == "research":
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

    # Custom tools. Deep Agents will add its built-in tools automatically.
    # Keep research() available in both modes.
    main_tools = [research]

    system_prompt = CODING_SYSTEM_PROMPT if mode == "coding" else RESEARCH_SYSTEM_PROMPT

    agent_graph = create_deep_agent(
        model=llm,
        system_prompt=system_prompt,
        tools=main_tools,
        middleware=[CopilotKitMiddleware()],
        checkpointer=MemorySaver(),
    )

    print(f"[AGENT] Agent created with mode={mode}, model={model_name}")
    print(f"[AGENT] Main tools: {[t.name for t in main_tools]}")

    return agent_graph.with_config({"recursion_limit": 100})
