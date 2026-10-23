# docs/ai/contracts

Contratos versionados (schemas) entre el producto y el AI Engine.

| Contrato                                                                      | Endpoint                                           | Spec      |
| ----------------------------------------------------------------------------- | -------------------------------------------------- | --------- |
| [retrieval-curriculum v1](retrieval-curriculum.v1.md)                         | `POST /v1/retrieval/curriculum`                    | SPEC-0005 |
| [generation-objective-suggestions v1](generation-objective-suggestions.v1.md) | `POST /v1/generation/objective-suggestions`        | SPEC-0007 |
| [generation-quiz, -workshop, -item-regenerate v1](generation-resources.v1.md) | `POST /v1/generation/quiz` · `/workshop` · `/item` | SPEC-0008 |
| [format-analysis v1](format-analysis.v1.md)                                   | `POST /v1/formats/analyze`                         | SPEC-0010 |
| [generation-exam v1 e item-regenerate v2](generation-exam.v1.md)              | `POST /v1/generation/exam` · `/exam/item`          | SPEC-0011 |
