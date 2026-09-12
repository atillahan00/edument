"""Kişisel kimlik kullanmadan, izin verilen özelliklerden açıklanabilir sıralama."""
import math
import re
import unicodedata
from typing import Protocol

WEIGHTS = dict(interest=.25, goal=.25, expertise=.20, availability=.10,
               experience=.08, language=.05, mode=.04, capacity=.03)
LABELS = dict(interest="İlgi uyumu", goal="Hedef uyumu", expertise="Beceri gelişimi ve uzmanlık",
              availability="Ortak uygunluk", experience="Mentorluk deneyimi", language="Ortak dil",
              mode="Görüşme biçimi ve şehir", capacity="Kalan kapasite")

def tokens(values):
    return set(re.findall(r"\w+", " ".join(values).translate(str.maketrans({"İ": "i", "I": "ı"})).lower()))

def overlap(desired, offered):
    a, b = tokens(desired), tokens(offered)
    return len(a & b) / len(a) if a else 0.0

def features(student, mentor):
    expertise = mentor.get("expertise", [])
    skills = [s["name"] for s in student.get("skills", []) if s.get("level", 5) < 5]
    sa, ma = set(student.get("availability", [])), set(mentor.get("availability", []))
    sm, mm = student.get("mode", "ONLINE"), mentor.get("mode", "ONLINE")
    compatible = sm == mm or "BOTH" in (sm, mm)
    city = unicodedata.normalize("NFC", student.get("city", "")).casefold()
    local = bool(city) and city == unicodedata.normalize("NFC", mentor.get("city", "")).casefold()
    mode = float(compatible and (sm != "IN_PERSON" and mm != "IN_PERSON" or local))
    capacity = mentor.get("capacity", 1)
    return dict(interest=overlap(student.get("interests", []), expertise + mentor.get("interests", [])),
                goal=overlap(student.get("goals", []), expertise + mentor.get("goals", [])),
                expertise=overlap(skills, expertise),
                availability=len(sa & ma) / len(sa) if sa else 0.0,
                experience=min(mentor.get("experience", 0) / 10, 1.0),
                language=overlap(student.get("languages", []), mentor.get("languages", [])),
                mode=mode, capacity=max(0, (capacity - mentor.get("usedCapacity", 0)) / capacity))

class Matcher(Protocol):
    def rank(self, student: dict, mentors: list[dict]) -> list[dict]: ...

class WeightedExplainableMatcher:
    version = "weighted-v1"
    def __init__(self, weights=None):
        self.weights = weights or WEIGHTS
        if set(self.weights) != set(WEIGHTS) or any(not math.isfinite(v) or v < 0 or v > 1 for v in self.weights.values()) or abs(sum(self.weights.values())-1) > 1e-8:
            raise ValueError("Ağırlıkların toplamı 1 olmalıdır.")

    def rank(self, student, mentors):
        results = []
        for mentor in mentors:
            if mentor.get("usedCapacity", 0) >= mentor.get("capacity", 1):
                continue
            component = features(student, mentor)
            contributions = {k: component[k]*w for k, w in self.weights.items()}
            results.append(dict(id=mentor["id"], score=sum(contributions.values()), components=component,
                                contributions=contributions, model=self.version,
                                explanation=[f"{LABELS[k]}: %{component[k]*100:.0f}; toplam puana katkı %{contributions[k]*100:.1f}.".replace(".", ",", 1) for k in self.weights]))
        return sorted(results, key=lambda r: (-r["score"], r["id"]))

class LogisticMatcher(WeightedExplainableMatcher):
    def __init__(self, artifact):
        super().__init__()
        if artifact["features"] != list(WEIGHTS) or artifact["sampleCount"] < 50:
            raise ValueError("Eğitim üstverisi yetersiz.")
        self.artifact = artifact
        self.version = artifact["version"]

    def rank(self, student, mentors):
        results = super().rank(student, mentors)
        for row in results:
            values = row["components"]
            terms = {k: values[k]*c for k, c in zip(self.artifact["features"], self.artifact["coefficients"])}
            logit = self.artifact["intercept"] + sum(terms.values())
            row["score"] = 1/(1+math.exp(-max(-700, min(700, logit))))
            row["contributions"] = terms
            row["explanation"] = [f"{LABELS[k]}: doğrusal model katkısı {v:.3f}." for k, v in terms.items()]
        return sorted(results, key=lambda r: (-r["score"], r["id"]))
