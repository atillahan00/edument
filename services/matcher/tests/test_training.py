import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pandas as pd
import numpy as np
from matcher import WEIGHTS, LogisticMatcher
from train import train
from fastapi.testclient import TestClient
from app import app

def test_explicit_training_produces_measured_versioned_artifact(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    rng = np.random.default_rng(2204)
    frame = pd.DataFrame(rng.random((100, 8)), columns=list(WEIGHTS))
    frame['outcome'] = (frame['goal'] + frame['availability'] > 1).astype(int)
    path = tmp_path / 'training.csv'
    frame.to_csv(path, index=False)
    train(path)
    artifact = json.loads(next((tmp_path / 'research-output/models').glob('*.json')).read_text())
    assert artifact['sampleCount'] == 100
    assert 0 <= artifact['metrics']['rocAuc'] <= 1
    assert artifact['testCount'] == 25
    assert LogisticMatcher(artifact).rank({}, []) == []

def test_missing_model_falls_back(monkeypatch):
    monkeypatch.setenv('MATCHER_USE_ML', 'true')
    monkeypatch.setenv('MATCHER_MODEL_PATH', 'missing-model.json')
    result = TestClient(app).post('/rank', json={'student': {}, 'mentors': []})
    assert result.status_code == 200
    assert result.json()['model'] == 'weighted-v1'
