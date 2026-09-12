"""Açık yönetici komutu; kullanıcı geri bildirimlerini kendiliğinden toplamaz."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score
from matcher import WEIGHTS

def train(file, seed=2204):
    frame = pd.read_csv(file)
    columns = list(WEIGHTS)
    if len(frame) < 50 or set(frame["outcome"].unique()) != {0, 1} or frame["outcome"].value_counts().min() < 10:
        raise ValueError("En az 50 gözlem ve her sınıfta en az 10 örnek gerekiyor.")
    features = frame[columns]
    if features.isna().any().any() or ((features < 0) | (features > 1)).any().any():
        raise ValueError("Özellikler 0 ile 1 arasında olmalıdır.")
    x_train, x_test, y_train, y_test = train_test_split(features, frame["outcome"], test_size=.25, random_state=seed, stratify=frame["outcome"])
    model = LogisticRegression(random_state=seed, max_iter=1000).fit(x_train, y_train)
    digest = hashlib.sha256(Path(file).read_bytes()).hexdigest()
    artifact = dict(version=f"logistic-{digest[:12]}-{seed}", features=columns,
                    trainedAt=datetime.now(timezone.utc).isoformat(), seed=seed, sampleCount=len(frame),
                    trainingDataHash=digest, testCount=len(x_test), coefficients=model.coef_[0].tolist(),
                    intercept=float(model.intercept_[0]), metrics=dict(accuracy=accuracy_score(y_test, model.predict(x_test)), rocAuc=roc_auc_score(y_test, model.predict_proba(x_test)[:, 1])))
    output = Path("research-output/models")
    output.mkdir(parents=True, exist_ok=True)
    path = output / f"{artifact['version']}.json"
    path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8")
    print(path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="İzinli özelliklerle tekrarlanabilir model eğitimi")
    parser.add_argument("--input", required=True)
    parser.add_argument("--seed", type=int, default=2204)
    args = parser.parse_args()
    train(args.input, args.seed)
