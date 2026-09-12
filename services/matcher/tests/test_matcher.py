import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest
from fastapi.testclient import TestClient
from app import app
from matcher import WeightedExplainableMatcher, WEIGHTS
from research import generate, evaluate

def data():
    return dict(interests=["robotik"], goals=["Python"], skills=[dict(name="Python", level=2)], languages=["Türkçe"]), [dict(id="a", expertise=["robotik", "Python"], capacity=3, experience=5, languages=["Türkçe"])]

def test_deterministic_normalized_and_additive():
    student, mentors = data()
    matcher = WeightedExplainableMatcher()
    rows = matcher.rank(student, mentors)
    assert rows == matcher.rank(student, mentors)
    for row in rows:
        assert 0 <= row["score"] <= 1
        assert row["score"] == pytest.approx(sum(row["contributions"].values()))
        assert all(0 <= x <= 1 for x in row["components"].values())

def test_sensitive_attributes_never_change_ranking():
    student, mentors = data()
    expected = WeightedExplainableMatcher().rank(student, mentors)
    student.update(gender="female", religion="private", ethnicity="private", disability="private", email="private")
    assert WeightedExplainableMatcher().rank(student, mentors) == expected

def test_capacity_and_empty():
    student, mentors = data()
    mentors[0]["usedCapacity"] = 3
    assert WeightedExplainableMatcher().rank(student, mentors) == []
    assert WeightedExplainableMatcher().rank(student, []) == []

def test_invalid_weights():
    with pytest.raises(ValueError):
        WeightedExplainableMatcher({**WEIGHTS, "interest": .9})

def test_http_real_matcher():
    student, mentors = data()
    response = TestClient(app).post("/rank", json=dict(student=student, mentors=mentors))
    assert response.status_code == 200
    assert response.json()["results"][0]["score"] > 0

def test_research_reproducible():
    assert generate(42, 5) == generate(42, 5)
    result = evaluate(generate(42, 5))
    assert all(0 <= metric <= 1 for metrics in result["metrics"].values() for metric in metrics.values())
