import json
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ConfigDict
from matcher import WEIGHTS, WeightedExplainableMatcher, LogisticMatcher

class Skill(BaseModel):
    name: str = Field(max_length=200)
    level: int = Field(ge=1, le=5)

class Profile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    interests: list[str] = Field(default_factory=list, max_length=40)
    goals: list[str] = Field(default_factory=list, max_length=40)
    skills: list[Skill] = Field(default_factory=list, max_length=40)
    availability: list[str] = Field(default_factory=list, max_length=40)
    languages: list[str] = Field(default_factory=list, max_length=40)
    mode: str = Field(default="ONLINE", pattern="^(ONLINE|IN_PERSON|BOTH)$")
    city: str = Field(default="", max_length=100)

class Mentor(Profile):
    id: str = Field(max_length=100)
    expertise: list[str] = Field(default_factory=list, max_length=40)
    experience: float = Field(default=0, ge=0, le=60)
    capacity: int = Field(default=1, ge=1, le=30)
    usedCapacity: int = Field(default=0, ge=0)

class RankRequest(BaseModel):
    student: Profile
    mentors: list[Mentor] = Field(max_length=500)
    weights: dict[str, float] = Field(default_factory=lambda: WEIGHTS.copy())

app = FastAPI(title="BILSEM-Chain Mentor Öneri Hizmeti", description="Kimlik ve hassas özellikler kullanılmaz.")

@app.exception_handler(RequestValidationError)
async def validation_error(_request, _error):
    return JSONResponse(status_code=422, content={"message": "Öneri girdileri geçersiz."})

@app.get("/health", summary="Hizmet sağlığı")
def health():
    return {"status": "ok"}

class ResearchRequest(BaseModel):
    seed: int = Field(default=2204, ge=0)
    samples: int = Field(default=5, ge=1, le=100)

@app.post("/research", summary="Yalıtılmış sentetik sıralama deneyi")
def research(request: ResearchRequest):
    from research import generate, evaluate
    return evaluate(generate(request.seed, request.samples))

@app.post("/rank", summary="Açıklanabilir mentor sıralaması")
def rank(request: RankRequest):
    try:
        matcher = WeightedExplainableMatcher(request.weights)
        reason = "Eğitilmiş model etkin olmadığı için açıklanabilir ağırlıklı model kullanıldı."
        artifact = os.getenv("MATCHER_MODEL_PATH")
        if artifact and os.getenv("MATCHER_USE_ML") == "true":
            try:
                matcher = LogisticMatcher(json.loads(Path(artifact).read_text(encoding="utf-8")))
                reason = "Yönetici tarafından etkinleştirilen, sürümlenmiş lojistik regresyon modeli kullanıldı."
            except (OSError, KeyError, ValueError):
                reason = "Geçerli eğitim üstverisi bulunamadı; açıklanabilir ağırlıklı modele dönüldü."
        return dict(model=matcher.version, message=reason,
                    results=matcher.rank(request.student.model_dump(), [m.model_dump() for m in request.mentors]))
    except (ValueError, KeyError, OSError):
        return JSONResponse(status_code=422, content={"message": "Öneri ağırlıkları veya model yapılandırması geçersiz."})
