"""Comandos del AI Engine.

uv run python -m app.cli index                    Reindexa el catálogo en Qdrant (SPEC-0005 T3).
uv run python -m app.cli benchmark [--dense M]    Mide recall@5 contra el benchmark (RN-06).
uv run python -m app.cli benchmark-generation     Sugerencia de objetivos (SPEC-0007 CA-0007-09).
uv run python -m app.cli benchmark-resources      Quices y talleres (SPEC-0008 CA-0008-13).
uv run python -m app.cli benchmark-exams          Exámenes por secciones (SPEC-0011 CA-0011-14).
"""

import argparse
import json
import time
from datetime import UTC, datetime
from pathlib import Path

from qdrant_client import QdrantClient

from .config import ENGINE_DIR, get_settings
from .generation.exams import EXAM_PROMPT_VERSION, ExamRequest, generate_exam
from .generation.objectives import (
    PROMPT_VERSION,
    GenerationInvalidError,
    ObjectiveRequest,
    suggest_objectives,
)
from .generation.pipeline import StructuredResult
from .generation.resources import (
    QUIZ_PROMPT_VERSION,
    WORKSHOP_PROMPT_VERSION,
    QuizRequest,
    WorkshopRequest,
    generate_quiz,
    generate_workshop,
)
from .providers import (
    LLMChain,
    LLMUnavailableError,
    LocalProvider,
    MockAIProvider,
    MockLLM,
    build_llm,
    build_provider,
)
from .retrieval.catalog import load_catalog
from .retrieval.index import build_index
from .retrieval.search import search_curriculum

BENCHMARK = ENGINE_DIR / "benchmarks" / "curriculum-retrieval.jsonl"
GENERATION_BENCHMARK = ENGINE_DIR / "benchmarks" / "generation-objectives.jsonl"
RESOURCES_BENCHMARK = ENGINE_DIR / "benchmarks" / "generation-resources.jsonl"
EXAMS_BENCHMARK = ENGINE_DIR / "benchmarks" / "generation-exams.jsonl"
RESULTS = ENGINE_DIR / "benchmarks" / "results"


def cmd_index() -> None:
    settings = get_settings()
    provider = build_provider(settings)
    items, version = load_catalog(settings.catalog_dir)
    started = time.perf_counter()
    count = build_index(
        QdrantClient(location=settings.qdrant_url), provider, settings.collection, items, version
    )
    elapsed = time.perf_counter() - started
    print(f"Indexados {count} ítems · catálogo {version} · {provider.dense_model} · {elapsed:.1f}s")


def load_benchmark(path: Path = BENCHMARK) -> list[dict]:
    return [
        json.loads(line) for line in path.read_text(encoding="utf8").splitlines() if line.strip()
    ]


def run_benchmark(provider, catalog_dir: Path, k: int = 5) -> dict:
    """Indexa en un Qdrant embebido y mide recall@k y latencia. No toca el índice real."""
    items, version = load_catalog(catalog_dir)
    client = QdrantClient(location=":memory:")
    build_index(client, provider, "bench", items, version)
    cases = load_benchmark()
    hits, top1, latencies, misses = 0, 0, [], []
    for case in cases:
        started = time.perf_counter()
        found = search_curriculum(
            client,
            provider,
            "bench",
            case["query"],
            area=case.get("area"),
            grade=case.get("grade"),
            limit=k,
        )
        latencies.append((time.perf_counter() - started) * 1000)
        codes = [h.code for h in found]
        top1 += bool(codes) and codes[0] in case["expected"]
        if set(codes) & set(case["expected"]):
            hits += 1
        else:
            misses.append({"query": case["query"], "expected": case["expected"], "got": codes})
    latencies.sort()
    return {
        "date": datetime.now(UTC).isoformat(timespec="seconds"),
        "provider": provider.name,
        "denseModel": provider.dense_model,
        "rerank": provider.rerank_enabled,
        "catalogVersion": version,
        "cases": len(cases),
        f"recall@{k}": round(hits / len(cases), 3),
        "recall@1": round(top1 / len(cases), 3),
        "latencyMs": {"p50": round(latencies[len(latencies) // 2]), "max": round(latencies[-1])},
        "misses": misses,
    }


def cmd_benchmark(dense_model: str | None, mock: bool) -> None:
    settings = get_settings()
    if mock:
        provider = MockAIProvider()
    else:
        provider = LocalProvider(
            dense_model=dense_model or settings.dense_model,
            sparse_model=settings.sparse_model,
            rerank_model=settings.rerank_model,
            cache_dir=settings.models_cache_dir,
        )
    result = run_benchmark(provider, settings.catalog_dir)
    RESULTS.mkdir(parents=True, exist_ok=True)
    name = f"{result['date'][:10]}-{provider.dense_model.split('/')[-1]}.json"
    (RESULTS / name).write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf8"
    )
    print(json.dumps({k: v for k, v in result.items() if k != "misses"}, ensure_ascii=False))
    for miss in result["misses"]:
        print("  fallo:", miss["query"], "esperado", miss["expected"], "obtuvo", miss["got"][:3])


def _dba_for(catalog_dir: Path, area: str, grade: str) -> list[dict]:
    refs = []
    for path in sorted(catalog_dir.glob("*.json")):
        for item in json.loads(path.read_text(encoding="utf8"))["items"]:
            if item["area"] == area and item.get("grade") == grade:
                refs.append(
                    {
                        "code": item["code"],
                        "statement": item["statement"],
                        "evidences": item["evidences"],
                    }
                )
    return refs


def cmd_benchmark_generation(mock: bool) -> None:
    """CA-0007-09: tasa de salidas válidas (a la primera y tras reparar) y latencia."""
    settings = get_settings()
    llm = LLMChain([MockLLM()]) if mock else build_llm(settings)
    cases = [
        json.loads(x) for x in GENERATION_BENCHMARK.read_text(encoding="utf8").splitlines() if x
    ]
    rows, latencies = [], []
    for case in cases:
        request = ObjectiveRequest(
            subject=case["subject"],
            grade=case["gradeLabel"],
            topic={"title": case["topic"], "description": None},
            existingObjectives=case["existing"],
            dba=_dba_for(settings.catalog_dir, case["area"], case["grade"]),
            count=3,
        )
        started = time.perf_counter()
        try:
            result = suggest_objectives(llm, request)
            rows.append(
                {
                    "topic": case["topic"],
                    "valid": True,
                    "attempts": result.attempts,
                    "model": result.model,
                    "suggestions": [s.statement for s in result.suggestions],
                }
            )
        except GenerationInvalidError as error:
            rows.append(
                {
                    "topic": case["topic"],
                    "valid": False,
                    "attempts": error.attempts,
                    "errors": error.errors,
                }
            )
        except LLMUnavailableError as error:
            rows.append(
                {"topic": case["topic"], "valid": False, "attempts": 0, "errors": [str(error)]}
            )
        latencies.append((time.perf_counter() - started) * 1000)
        print(
            f"  {case['topic']}: {'válido' if rows[-1]['valid'] else 'inválido'} "
            f"({rows[-1]['attempts']} intento/s, {latencies[-1] / 1000:.0f} s)",
            flush=True,
        )
    latencies.sort()
    valid = [r for r in rows if r["valid"]]
    result = {
        "date": datetime.now(UTC).isoformat(timespec="seconds"),
        "chain": llm.name,
        "model": llm.model,
        "promptVersion": PROMPT_VERSION,
        "cases": len(rows),
        "validRate": round(len(valid) / len(rows), 3),
        "firstAttemptRate": round(sum(r["attempts"] == 1 for r in valid) / len(rows), 3),
        "latencyMs": {"p50": round(latencies[len(latencies) // 2]), "max": round(latencies[-1])},
        "rows": rows,
    }
    RESULTS.mkdir(parents=True, exist_ok=True)
    name = f"{result['date'][:10]}-generation-{llm.model.split('/')[-1].replace(':', '-')}.json"
    content = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    (RESULTS / name).write_text(content, encoding="utf8")
    print(json.dumps({k: v for k, v in result.items() if k != "rows"}, ensure_ascii=False))


def _resource_request(case: dict, catalog_dir: Path) -> QuizRequest | WorkshopRequest:
    dba = _dba_for(catalog_dir, case["area"], case["grade"]) if case["area"] else []
    fields = {
        "subject": case["subject"],
        "grade": case["gradeLabel"],
        "topic": {"title": case["topic"], "description": None},
        "objectives": case["objectives"],
        # Como en la web: los DBA vinculados a los objetivos elegidos, no todos los del grado.
        "dba": [dba[i] for i in case["dba"]],
        "difficulty": case["difficulty"],
        "durationMinutes": case["durationMinutes"],
        "itemCount": case["itemCount"],
        "cognitiveDistribution": case["cognitiveDistribution"],
    }
    if case["type"] == "QUIZ":
        return QuizRequest(**fields, questionTypes=case["questionTypes"])
    return WorkshopRequest(**fields, structure=case["structure"])


def cmd_benchmark_resources(mock: bool, pause_s: float) -> None:
    """CA-0008-13: salidas válidas, intentos, latencia y tokens de quices y talleres."""
    settings = get_settings()
    llm = LLMChain([MockLLM()]) if mock else build_llm(settings)
    cases = [
        json.loads(x) for x in RESOURCES_BENCHMARK.read_text(encoding="utf8").splitlines() if x
    ]
    rows = []
    for n, case in enumerate(cases):
        if n and pause_s:
            time.sleep(pause_s)  # el plan gratuito limita tokens por minuto (ADR-0007)
        request = _resource_request(case, settings.catalog_dir)
        label = f"{case['type']} {case['gradeLabel']} {case['topic']}"
        started = time.perf_counter()
        try:
            result: StructuredResult = (
                generate_quiz(llm, request)
                if isinstance(request, QuizRequest)
                else generate_workshop(llm, request)
            )
            rows.append(
                {
                    "case": label,
                    "valid": True,
                    "attempts": result.attempts,
                    "tokens": result.tokens,
                    "model": result.model,
                    "output": result.value.model_dump(),
                }
            )
        except GenerationInvalidError as error:
            rows.append(
                {"case": label, "valid": False, "attempts": error.attempts, "errors": error.errors}
            )
        except LLMUnavailableError as error:
            rows.append({"case": label, "valid": False, "attempts": 0, "errors": [str(error)]})
        rows[-1]["latencyMs"] = round((time.perf_counter() - started) * 1000)
        print(
            f"  {label}: {'válido' if rows[-1]['valid'] else 'inválido'} "
            f"({rows[-1]['attempts']} intento/s, {rows[-1]['latencyMs'] / 1000:.0f} s, "
            f"{rows[-1].get('tokens', 0)} tokens)",
            flush=True,
        )
    valid = [r for r in rows if r["valid"]]
    latencies = sorted(r["latencyMs"] for r in rows)
    tokens = sorted(r["tokens"] for r in valid) or [0]
    result = {
        "date": datetime.now(UTC).isoformat(timespec="seconds"),
        "chain": llm.name,
        "model": llm.model,
        "promptVersions": [QUIZ_PROMPT_VERSION, WORKSHOP_PROMPT_VERSION],
        "cases": len(rows),
        "validRate": round(len(valid) / len(rows), 3),
        "firstAttemptRate": round(sum(r["attempts"] == 1 for r in valid) / len(rows), 3),
        "latencyMs": {"p50": latencies[len(latencies) // 2], "max": latencies[-1]},
        "tokens": {"p50": tokens[len(tokens) // 2], "max": tokens[-1]},
        "pauseS": pause_s,
        "rows": rows,
    }
    RESULTS.mkdir(parents=True, exist_ok=True)
    name = f"{result['date'][:10]}-resources-{llm.model.split('/')[-1].replace(':', '-')}.json"
    content = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    (RESULTS / name).write_text(content, encoding="utf8")
    print(json.dumps({k: v for k, v in result.items() if k != "rows"}, ensure_ascii=False))


# SPEC-0011: pesos para repartir 100 puntos entre secciones, como hace la web (RN-06).
POINT_WEIGHTS = {
    "MULTIPLE_CHOICE": 1,
    "TRUE_FALSE": 1,
    "SHORT_ANSWER": 1.5,
    "MATCHING": 3,
    "OPEN": 3,
}


def _exam_request(case: dict, catalog_dir: Path) -> ExamRequest:
    dba = _dba_for(catalog_dir, case["area"], case["grade"]) if case["area"] else []
    weight = sum(POINT_WEIGHTS[t] * n for t, n in case["sections"])
    return ExamRequest(
        subject=case["subject"],
        grade=case["gradeLabel"],
        topics=[{"key": f"T{i + 1}", "title": t} for i, t in enumerate(case["topics"])],
        objectives=case["objectives"],
        dba=[dba[i] for i in case["dba"]],
        difficulty=case["difficulty"],
        durationMinutes=case["durationMinutes"],
        sections=[
            {
                "questionType": t,
                "questionCount": n,
                "pointsPerQuestion": max(0.1, round(100 * POINT_WEIGHTS[t] / weight, 1)),
            }
            for t, n in case["sections"]
        ],
        cognitiveDistribution=case["cognitiveDistribution"],
    )


def cmd_benchmark_exams(mock: bool, pause_s: float) -> None:
    """CA-0011-14: salidas válidas, intentos, latencia, tokens y llamadas por examen."""
    settings = get_settings()
    llm = LLMChain([MockLLM()]) if mock else build_llm(settings)
    cases = [json.loads(x) for x in EXAMS_BENCHMARK.read_text(encoding="utf8").splitlines() if x]
    rows = []
    for n, case in enumerate(cases):
        if n and pause_s:
            time.sleep(pause_s)  # el plan gratuito limita tokens por minuto (ADR-0007)
        request = _exam_request(case, settings.catalog_dir)
        questions = sum(s.questionCount for s in request.sections)
        label = f"{case['subject']} {case['gradeLabel']} ({questions} preguntas)"
        started = time.perf_counter()
        try:
            result = generate_exam(llm, request)
            rows.append(
                {
                    "case": label,
                    "questions": questions,
                    "valid": True,
                    "attempts": result.attempts,
                    "calls": len(result.calls),
                    "tokens": result.tokens,
                    "maxTokensPerCall": max(c.tokens for c in result.calls),
                    "model": result.model,
                    "perCall": [
                        {"attempts": c.attempts, "latencyMs": c.latency_ms, "tokens": c.tokens}
                        for c in result.calls
                    ],
                    "output": result.value.model_dump(),
                }
            )
        except GenerationInvalidError as error:
            rows.append(
                {
                    "case": label,
                    "questions": questions,
                    "valid": False,
                    "attempts": error.attempts,
                    "errors": error.errors,
                }
            )
        except LLMUnavailableError as error:
            rows.append(
                {
                    "case": label,
                    "questions": questions,
                    "valid": False,
                    "attempts": 0,
                    "errors": [str(error)],
                }
            )
        rows[-1]["latencyMs"] = round((time.perf_counter() - started) * 1000)
        print(
            f"  {label}: {'válido' if rows[-1]['valid'] else 'inválido'} "
            f"({rows[-1].get('calls', 0)} llamadas, {rows[-1]['attempts']} intentos, "
            f"{rows[-1]['latencyMs'] / 1000:.0f} s, {rows[-1].get('tokens', 0)} tokens)",
            flush=True,
        )
    valid = [r for r in rows if r["valid"]]
    latencies = sorted(r["latencyMs"] for r in rows)
    tokens = sorted(r["tokens"] for r in valid) or [0]
    result = {
        "date": datetime.now(UTC).isoformat(timespec="seconds"),
        "chain": llm.name,
        "model": llm.model,
        "promptVersions": [EXAM_PROMPT_VERSION],
        "cases": len(rows),
        "validRate": round(len(valid) / len(rows), 3),
        # Primer intento en todas las secciones del examen.
        "firstAttemptRate": round(sum(r["attempts"] == r["calls"] for r in valid) / len(rows), 3),
        "latencyMs": {"p50": latencies[len(latencies) // 2], "max": latencies[-1]},
        "tokens": {"p50": tokens[len(tokens) // 2], "max": tokens[-1]},
        "maxTokensPerCall": max((r["maxTokensPerCall"] for r in valid), default=0),
        "calls": {"p50": sorted(r["calls"] for r in valid or [{"calls": 0}])[len(valid) // 2]},
        "pauseS": pause_s,
        "rows": rows,
    }
    RESULTS.mkdir(parents=True, exist_ok=True)
    name = f"{result['date'][:10]}-exams-{llm.model.split('/')[-1].replace(':', '-')}.json"
    content = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    (RESULTS / name).write_text(content, encoding="utf8")
    print(json.dumps({k: v for k, v in result.items() if k != "rows"}, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("index")
    bench = sub.add_parser("benchmark")
    bench.add_argument("--dense", default=None, help="Modelo denso a evaluar")
    bench.add_argument("--mock", action="store_true", help="Usar el proveedor de prueba")
    gen = sub.add_parser("benchmark-generation")
    gen.add_argument("--mock", action="store_true", help="Usar el LLM de prueba")
    res = sub.add_parser("benchmark-resources")
    res.add_argument("--mock", action="store_true", help="Usar el LLM de prueba")
    res.add_argument("--pause", type=float, default=20.0, help="Segundos entre casos")
    exams = sub.add_parser("benchmark-exams")
    exams.add_argument("--mock", action="store_true", help="Usar el LLM de prueba")
    exams.add_argument("--pause", type=float, default=60.0, help="Segundos entre casos")
    args = parser.parse_args()
    if args.command == "index":
        cmd_index()
    elif args.command == "benchmark-generation":
        cmd_benchmark_generation(args.mock)
    elif args.command == "benchmark-resources":
        cmd_benchmark_resources(args.mock, 0 if args.mock else args.pause)
    elif args.command == "benchmark-exams":
        cmd_benchmark_exams(args.mock, 0 if args.mock else args.pause)
    else:
        cmd_benchmark(args.dense, args.mock)


if __name__ == "__main__":
    main()
