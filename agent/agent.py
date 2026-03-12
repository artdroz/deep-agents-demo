"""
Deep Research Assistant Agent

A Deep Agents-powered research assistant that demonstrates CopilotKit's
planning, filesystem, and subagent capabilities using Tavily for web research.

This agent also supports Azure OpenAI via environment variables.
"""

import os

from dotenv import load_dotenv
from deepagents import create_deep_agent
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from copilotkit import CopilotKitMiddleware

from tools import research

load_dotenv()


# Main agent system prompt - coordinates research and synthesizes findings
MAIN_SYSTEM_PROMPT = """You are a Deep Research Assistant, an expert at planning and
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


def _build_llm():
    provider = os.environ.get("PROVIDER", "openai").strip().lower()
    model_name = os.environ.get("OPENAI_MODEL", "gpt-5.2")

    if provider == "azure":
        api_key = os.environ.get("AZURE_OPENAI_API_KEY")
        endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
        deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT")
        api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21")

        missing = [
            name
            for name, value in {
                "AZURE_OPENAI_API_KEY": api_key,
                "AZURE_OPENAI_ENDPOINT": endpoint,
                "AZURE_OPENAI_DEPLOYMENT": deployment,
            }.items()
            if not value
        ]
        if missing:
            raise RuntimeError(
                "Missing Azure OpenAI environment variables: " + ", ".join(missing)
            )

        return AzureChatOpenAI(
            azure_endpoint=endpoint,
            azure_deployment=deployment,
            api_key=api_key,
            api_version=api_version,
            temperature=0.7,
        )

    # Default: OpenAI
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY environment variable")

    return ChatOpenAI(
        model=model_name,
        temperature=0.7,
        api_key=api_key,
    )


def build_agent():
    """Build the Deep Research Agent with CopilotKit integration.

    Creates a main research coordinator agent with a researcher subagent.
    Uses CopilotKitMiddleware for frontend state sync and generative UI.

    Returns:
        Compiled LangGraph StateGraph configured for research tasks
    """
    # Check for Tavily API key
    tavily_key = os.environ.get("TAVILY_API_KEY")
    if not tavily_key:
        raise RuntimeError("Missing TAVILY_API_KEY environment variable")

    llm = _build_llm()

    # Main agent gets research tool plus built-in Deep Agents tools
    # (write_todos, read_file, write_file)
    # The research tool wraps an internal Deep Agent that runs via .invoke()
    # so its text doesn't stream to the frontend
    main_tools = [research]

    # Create the Deep Agent with CopilotKit middleware
    # No subagents - research() tool handles web search internally
    agent_graph = create_deep_agent(
        model=llm,
        system_prompt=MAIN_SYSTEM_PROMPT,
        tools=main_tools,
        middleware=[CopilotKitMiddleware()],
        checkpointer=MemorySaver(),
    )

    print(f"[AGENT] Deep Research Agent created with provider={os.environ.get('PROVIDER','openai')}")
    print(f"[AGENT] Main tools: {[t.name for t in main_tools]}")

    # Configure recursion limit for complex research tasks
    return agent_graph.with_config({"recursion_limit": 100})
