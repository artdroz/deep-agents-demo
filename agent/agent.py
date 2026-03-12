"""agent.py

This repo supports two modes:

- research (default): original Deep Research Assistant behavior
- coding: enables an IDE-style agent with filesystem + shell tools

Mode is selected via the AGENT_MODE environment variable.
"""

import os

from copilotkit import CopilotKitMiddleware
from deepagents import create_deep_agent
from deepagents.middleware import FilesystemMiddleware
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver

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


CODING_SYSTEM_PROMPT = """You are a Coding Agent inside an IDE.

Hard rules (ALWAYS follow):
- Prefer using tools over guessing.
- Make small, safe changes and verify with execute_command when possible.
- Keep the user updated with concise progress.

Your workflow:
1. Understand the task and write_todos with clear steps
2. Inspect the repo (list_directory/read_file/grep) before changing anything
3. Implement changes using write_file/edit_file
4. Run tests/linters/build via execute_command
5. Summarize what changed and how to verify

You have access to filesystem and shell tools in coding mode."""


def _get_agent_mode() -> str:
    mode = (os.environ.get("AGENT_MODE") or "research").strip().lower()
    return mode if mode in {"research", "coding"} else "research"


def build_agent():
    """Build the Deep Agent with CopilotKit integration.

    Returns:
        Compiled LangGraph StateGraph configured for the selected mode.
    """

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY environment variable")

    mode = _get_agent_mode()

    # Tavily is only required for research mode.
    # The research tool remains registered in both modes, but it will error
    # at runtime if used without TAVILY_API_KEY.
    if mode == "research":
        tavily_key = os.environ.get("TAVILY_API_KEY")
        if not tavily_key:
            raise RuntimeError("Missing TAVILY_API_KEY environment variable")

    model_name = os.environ.get("OPENAI_MODEL", "gpt-5.2")
    llm = ChatOpenAI(
        model=model_name,
        temperature=0.7,
        api_key=api_key,
    )

    # Always expose research tool (optional in coding mode)
    main_tools = [research]

    system_prompt = CODING_SYSTEM_PROMPT if mode == "coding" else RESEARCH_SYSTEM_PROMPT

    # In coding mode, add Deep Agents filesystem tools via middleware.
    # Note: execute_command is only available if the backend supports execution.
    middleware = [CopilotKitMiddleware()]
    if mode == "coding":
        middleware.insert(0, FilesystemMiddleware())

    agent_graph = create_deep_agent(
        model=llm,
        system_prompt=system_prompt,
        tools=main_tools,
        middleware=middleware,
        checkpointer=MemorySaver(),
    )

    print(f"[AGENT] Agent created with model={model_name}, mode={mode}")
    print(f"[AGENT] Main tools: {[t.name for t in main_tools]}")

    return agent_graph.with_config({"recursion_limit": 100})
