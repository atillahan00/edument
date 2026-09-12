import argparse
import json
import random
import math
from pathlib import Path
from matcher import WeightedExplainableMatcher, overlap

ROOT = Path("research-output")
def generate(seed=2204, count=100):
    rng = random.Random(seed)
    topics = ["robotik", "fizik", "yazılım", "matematik", "biyoloji", "astronomi"]
    cases = []
    for i in range(count):
        target = rng.choice(topics)
        student = dict(interests=rng.sample(topics, 2), goals=[target], languages=["Türkçe"], availability=["Pazartesi 17:00"], skills=[dict(name=target, level=2)])
        mentors = [dict(id=f"araştırma-{i}-{j}", expertise=rng.sample(topics, 2), goals=[], experience=rng.randrange(11), capacity=3, usedCapacity=rng.randrange(3), languages=["Türkçe"], availability=rng.choice([["Pazartesi 17:00"], ["Salı 18:00"]])) for j in range(20)]
        # Predeclared synthetic relevance rule, separate from the evaluated score formula.
        relevant = [m["id"] for m in mentors if target in m["expertise"] and m["availability"] == student["availability"]]
        cases.append(dict(student=student, mentors=mentors, relevant=relevant))
    return dict(seed=seed, sampleCount=count, labelRule="Hedef uzmanlığı ve ortak zaman; sentetik uygunluk etiketi", cases=cases)

def metrics(ranking, relevant, k=5):
    relevant = set(relevant)
    selected = ranking[:k]
    hits = [int(v in relevant) for v in selected]
    dcg = sum(v / math.log2(i+2) for i, v in enumerate(hits))
    ideal = sum(1/math.log2(i+2) for i in range(min(k, len(relevant))))
    return dict(precision=sum(hits)/k, recall=sum(hits)/len(relevant) if relevant else None,
                mrr=next((1/(i+1) for i, v in enumerate(ranking) if v in relevant), 0), ndcg=dcg/ideal if ideal else None)

def evaluate(data):
    result = {}
    for strategy in ("baseline", "weighted"):
        values = []
        for case in data["cases"]:
            if strategy == "baseline":
                ranking = [m["id"] for m in sorted(case["mentors"], key=lambda m: (-overlap(case["student"]["interests"], m["expertise"]), m["id"]))]
            else:
                ranking = [m["id"] for m in WeightedExplainableMatcher().rank(case["student"], case["mentors"])]
            values.append(metrics(ranking, case["relevant"]))
        result[strategy] = {key: sum(v[key] for v in values if v[key] is not None)/max(1, sum(v[key] is not None for v in values)) for key in ["precision", "recall", "mrr", "ndcg"]}
    return dict(seed=data["seed"], sampleCount=data["sampleCount"], metrics=result, labelRule=data["labelRule"], warning="Sentetik sonuçlar gerçek mentorluk başarısını göstermez.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["generate", "run", "cleanup"])
    parser.add_argument("--seed", type=int, default=2204)
    args = parser.parse_args()
    if args.command == "cleanup":
        for name in ("dataset.json", "matching-result.json"):
            (ROOT / name).unlink(missing_ok=True)
    else:
        ROOT.mkdir(exist_ok=True)
        if args.command == "generate":
            data = generate(args.seed)
            (ROOT / "dataset.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            print("Ayrı araştırma veri kümesi üretildi.")
        else:
            result = evaluate(json.loads((ROOT / "dataset.json").read_text(encoding="utf-8")))
            (ROOT / "matching-result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps(result, ensure_ascii=False))
