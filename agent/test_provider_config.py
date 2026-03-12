import os
import types
import importlib


def _reload_agent_module():
    # Ensure env changes apply
    if 'agent.agent' in importlib.sys.modules:
        del importlib.sys.modules['agent.agent']
    return importlib.import_module('agent.agent')


def test_provider_openai_missing_key_raises(monkeypatch):
    monkeypatch.setenv('PROVIDER', 'openai')
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    monkeypatch.setenv('TAVILY_API_KEY', 'x')

    mod = _reload_agent_module()
    try:
        mod.build_agent()
    except RuntimeError as e:
        assert 'OPENAI_API_KEY' in str(e)
    else:
        raise AssertionError('Expected RuntimeError')


def test_provider_azure_missing_vars_raises(monkeypatch):
    monkeypatch.setenv('PROVIDER', 'azure')
    monkeypatch.setenv('TAVILY_API_KEY', 'x')
    for k in ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_DEPLOYMENT']:
        monkeypatch.delenv(k, raising=False)

    mod = _reload_agent_module()
    try:
        mod.build_agent()
    except RuntimeError as e:
        s = str(e)
        assert 'AZURE_OPENAI_API_KEY' in s
        assert 'AZURE_OPENAI_ENDPOINT' in s
        assert 'AZURE_OPENAI_DEPLOYMENT' in s
    else:
        raise AssertionError('Expected RuntimeError')
