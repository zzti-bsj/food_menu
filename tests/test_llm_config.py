import pytest

from llm.config import load_profiles, profile_for


ENV = {
    "SHIKE_LLM_PROVIDER": "glm",
    "SHIKE_LLM_GLM_API_KEY": "k1",
    "SHIKE_LLM_GLM_BASE_URL": "https://a",
    "SHIKE_LLM_GLM_MODEL": "m1",
    "SHIKE_LLM_DEEPSEEK_API_KEY": "k2",
    "SHIKE_LLM_DEEPSEEK_BASE_URL": "https://b",
    "SHIKE_LLM_DEEPSEEK_MODEL": "m2",
    "SHIKE_LLM_ROLE_VERIFY": "deepseek",
}


def test_load_profiles_groups_by_name():
    profiles = load_profiles(ENV)
    assert profiles["glm"] == {"api_key": "k1", "base_url": "https://a", "model": "m1"}
    assert profiles["deepseek"]["model"] == "m2"


def test_load_profiles_ignores_role_and_provider_keys():
    profiles = load_profiles(ENV)
    assert "role" not in profiles
    assert "provider" not in profiles


def test_profile_for_role_and_default(monkeypatch):
    monkeypatch.delenv("SHIKE_LLM_ROLE_FILL", raising=False)
    for key, value in ENV.items():
        monkeypatch.setenv(key, value)
    assert profile_for("fill") == "glm"
    assert profile_for("verify") == "deepseek"


def test_profile_for_unknown_raises(monkeypatch):
    monkeypatch.delenv("SHIKE_LLM_PROVIDER", raising=False)
    monkeypatch.delenv("SHIKE_LLM_ROLE_FILL", raising=False)
    with pytest.raises(ValueError, match="未找到 LLM 档案"):
        profile_for("fill")
