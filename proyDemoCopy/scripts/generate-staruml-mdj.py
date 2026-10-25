"""
Genera archivos .mdj nativos de StarUML para los 9 diagramas de ProyDemo.

Salida en: diagrams/staruml/
Formato: JSON .mdj válido (StarUML 4.x / 5.x / 6.x)

Cada .mdj contiene un Project + UMLModel con todos los elementos UML.
Los DIAGRAMAS (vistas) se incluyen con posiciones auto-calculadas en grid.

Tipos generados:
- ER / Modelo Relacional → UMLClass con stereotype <<Table>>
- Clases UML            → UMLClass con stereotype Port/Adapter/UseCase
- Casos de Uso          → UMLActor + UMLUseCase + UMLAssociation
- Componentes           → UMLComponent
- Estados               → UMLStateMachine
- Secuencia             → UMLCollaboration + Lifelines + Messages

Uso: python scripts/generate-staruml-mdj.py
"""
import json
import os
from itertools import count

OUT_DIR = r"C:\Users\angui\Documents\proyDemo\diagrams\staruml"
os.makedirs(OUT_DIR, exist_ok=True)

_id_counter = count(1)


def nid(prefix="E"):
    return f"AAA{prefix}{next(_id_counter):04d}"


def ref(_id):
    return {"$ref": _id}


def make_project(name):
    pid = nid("P")
    mid = nid("M")
    project = {
        "_type": "Project",
        "_id": pid,
        "name": name,
        "ownedElements": [],
    }
    model = {
        "_type": "UMLModel",
        "_id": mid,
        "_parent": ref(pid),
        "name": "Model",
        "ownedElements": [],
    }
    project["ownedElements"].append(model)
    return project, model


def make_attr(parent_id, name, typ, visibility="public", is_id=False):
    aid = nid("A")
    return {
        "_type": "UMLAttribute",
        "_id": aid,
        "_parent": ref(parent_id),
        "name": name,
        "visibility": visibility,
        "type": typ,
        "isID": is_id,
    }


def make_class(model_id, name, stereotype=None, attrs=None, patterns=None, documentation=None):
    cid = nid("C")
    # Compose stereotype with patterns inline so they show as «Role, Pattern1, Pattern2»
    stereo_parts = []
    if stereotype:
        stereo_parts.append(stereotype)
    if patterns:
        stereo_parts.extend(patterns)
    stereo_str = ", ".join(stereo_parts)
    # Documentation field — shown in StarUML info panel when class is selected
    doc_parts = []
    if patterns:
        doc_parts.append("Patrones aplicados: " + ", ".join(patterns))
    if documentation:
        doc_parts.append(documentation)
    doc_str = "\n".join(doc_parts)
    klass = {
        "_type": "UMLClass",
        "_id": cid,
        "_parent": ref(model_id),
        "name": name,
        "stereotype": stereo_str,
        "documentation": doc_str,
        "attributes": [],
        "operations": [],
    }
    for a in (attrs or []):
        klass["attributes"].append(make_attr(cid, a["name"], a["type"], is_id=a.get("pk", False)))
    return klass


def make_actor(model_id, name):
    return {
        "_type": "UMLActor",
        "_id": nid("AC"),
        "_parent": ref(model_id),
        "name": name,
    }


def make_usecase(model_id, name):
    return {
        "_type": "UMLUseCase",
        "_id": nid("UC"),
        "_parent": ref(model_id),
        "name": name,
    }


def make_component(model_id, name, stereotype="", patterns=None, documentation=None):
    stereo_parts = []
    if stereotype:
        stereo_parts.append(stereotype)
    if patterns:
        stereo_parts.extend(patterns)
    stereo_str = ", ".join(stereo_parts)
    doc_parts = []
    if patterns:
        doc_parts.append("Patrones aplicados: " + ", ".join(patterns))
    if documentation:
        doc_parts.append(documentation)
    doc_str = "\n".join(doc_parts)
    return {
        "_type": "UMLComponent",
        "_id": nid("CM"),
        "_parent": ref(model_id),
        "name": name,
        "stereotype": stereo_str,
        "documentation": doc_str,
    }


def make_association(model_id, from_el, to_el, name="", mult_from="1", mult_to="*"):
    aid = nid("AS")
    end_from_id = nid("E1")
    end_to_id = nid("E2")
    return {
        "_type": "UMLAssociation",
        "_id": aid,
        "_parent": ref(model_id),
        "name": name,
        "end1": {
            "_type": "UMLAssociationEnd",
            "_id": end_from_id,
            "_parent": ref(aid),
            "reference": ref(from_el["_id"]),
            "multiplicity": mult_from,
        },
        "end2": {
            "_type": "UMLAssociationEnd",
            "_id": end_to_id,
            "_parent": ref(aid),
            "reference": ref(to_el["_id"]),
            "multiplicity": mult_to,
            "navigable": "navigable",
        },
    }


def make_dependency(model_id, source, target, stereotype=""):
    return {
        "_type": "UMLDependency",
        "_id": nid("D"),
        "_parent": ref(model_id),
        "source": ref(source["_id"]),
        "target": ref(target["_id"]),
        "stereotype": stereotype,
    }


def make_realization(model_id, source, target):
    return {
        "_type": "UMLInterfaceRealization",
        "_id": nid("IR"),
        "_parent": ref(model_id),
        "source": ref(source["_id"]),
        "target": ref(target["_id"]),
    }


def make_include(model_id, source_uc, target_uc):
    """include relationship between use cases — stereotype «include»"""
    return {
        "_type": "UMLInclude",
        "_id": nid("INC"),
        "_parent": ref(model_id),
        "source": ref(source_uc["_id"]),
        "target": ref(target_uc["_id"]),
    }


def make_extend(model_id, source_uc, target_uc):
    """extend relationship between use cases — stereotype «extend»"""
    return {
        "_type": "UMLExtend",
        "_id": nid("EXT"),
        "_parent": ref(model_id),
        "source": ref(source_uc["_id"]),
        "target": ref(target_uc["_id"]),
    }


def make_note(model_id, text):
    """UMLConstraint serves as a note/annotation in StarUML."""
    return {
        "_type": "UMLConstraint",
        "_id": nid("N"),
        "_parent": ref(model_id),
        "name": "Nota",
        "specification": text,
    }


def make_note_view(diagram_id, note_el, x, y, w=240, h=80):
    return {
        "_type": "UMLConstraintView",
        "_id": nid("V"),
        "_parent": ref(diagram_id),
        "model": ref(note_el["_id"]),
        "left": x,
        "top": y,
        "width": w,
        "height": h,
    }


def make_operation(parent_id, name, return_type="void", params=None, visibility="public"):
    """Crea operación UML (método) para clase/interfaz."""
    oid = nid("O")
    op = {
        "_type": "UMLOperation",
        "_id": oid,
        "_parent": ref(parent_id),
        "name": name,
        "visibility": visibility,
        "parameters": [],
    }
    # Parameter de retorno
    op["parameters"].append({
        "_type": "UMLParameter",
        "_id": nid("PR"),
        "_parent": ref(oid),
        "name": "return",
        "type": return_type,
        "direction": "return",
    })
    for p in (params or []):
        op["parameters"].append({
            "_type": "UMLParameter",
            "_id": nid("P"),
            "_parent": ref(oid),
            "name": p["name"],
            "type": p["type"],
            "direction": p.get("dir", "in"),
        })
    return op


def add_ops(klass, ops):
    """Helper: append list of (name, return_type, params) to class operations."""
    for spec in ops:
        if isinstance(spec, str):
            name, ret, params = spec, "void", []
        elif len(spec) == 2:
            name, ret = spec
            params = []
        else:
            name, ret, params = spec
        klass["operations"].append(make_operation(klass["_id"], name, return_type=ret, params=params))


# ============== EDGE VIEWS (relaciones visibles en diagrama) ==============
def _base_edge_view(diagram_id, view_type, model_el, tail_view, head_view):
    """Estructura base para todas las edge views (asoc, dep, realiz, include, extend)."""
    return {
        "_type": view_type,
        "_id": nid("EV"),
        "_parent": ref(diagram_id),
        "model": ref(model_el["_id"]),
        "tail": ref(tail_view["_id"]),
        "head": ref(head_view["_id"]),
        "lineStyle": 1,
        "points": "0:0;0:0",
    }


def make_assoc_view(diagram_id, assoc_el, tail_view, head_view):
    v = _base_edge_view(diagram_id, "UMLAssociationView", assoc_el, tail_view, head_view)
    # roleViews para mostrar multiplicidad
    v["tailRoleView"] = {
        "_type": "UMLAssociationEndView",
        "_id": nid("RE"),
        "_parent": ref(v["_id"]),
        "model": ref(assoc_el["end1"]["_id"]),
    }
    v["headRoleView"] = {
        "_type": "UMLAssociationEndView",
        "_id": nid("RE"),
        "_parent": ref(v["_id"]),
        "model": ref(assoc_el["end2"]["_id"]),
    }
    v["nameLabel"] = {
        "_type": "EdgeLabelView",
        "_id": nid("EL"),
        "_parent": ref(v["_id"]),
        "text": assoc_el.get("name", ""),
    }
    return v


def make_dep_view(diagram_id, dep_el, tail_view, head_view):
    v = _base_edge_view(diagram_id, "UMLDependencyView", dep_el, tail_view, head_view)
    v["nameLabel"] = {
        "_type": "EdgeLabelView",
        "_id": nid("EL"),
        "_parent": ref(v["_id"]),
        "text": dep_el.get("name", dep_el.get("stereotype", "")),
    }
    return v


def make_realization_view(diagram_id, real_el, tail_view, head_view):
    return _base_edge_view(diagram_id, "UMLInterfaceRealizationView", real_el, tail_view, head_view)


def make_include_view(diagram_id, inc_el, tail_view, head_view):
    return _base_edge_view(diagram_id, "UMLIncludeView", inc_el, tail_view, head_view)


def make_extend_view(diagram_id, ext_el, tail_view, head_view):
    return _base_edge_view(diagram_id, "UMLExtendView", ext_el, tail_view, head_view)


# ============== VISTAS (diagramas con posiciones) ==============
def make_class_view(diagram_id, model_el, x, y, w=180, h=140):
    vid = nid("V")
    return {
        "_type": "UMLClassView",
        "_id": vid,
        "_parent": ref(diagram_id),
        "model": ref(model_el["_id"]),
        "left": x,
        "top": y,
        "width": w,
        "height": h,
        "containerChangeable": True,
        "showVisibility": False,
        "showOperationSignature": True,
        "stereotypeDisplay": "label",
        "suppressAttributes": False,
        "suppressOperations": False,
    }


def make_usecase_view(diagram_id, model_el, x, y):
    return {
        "_type": "UMLUseCaseView",
        "_id": nid("V"),
        "_parent": ref(diagram_id),
        "model": ref(model_el["_id"]),
        "left": x,
        "top": y,
        "width": 130,
        "height": 60,
    }


def make_actor_view(diagram_id, model_el, x, y):
    return {
        "_type": "UMLActorView",
        "_id": nid("V"),
        "_parent": ref(diagram_id),
        "model": ref(model_el["_id"]),
        "left": x,
        "top": y,
        "width": 60,
        "height": 80,
    }


def make_component_view(diagram_id, model_el, x, y, w=160, h=80):
    return {
        "_type": "UMLComponentView",
        "_id": nid("V"),
        "_parent": ref(diagram_id),
        "model": ref(model_el["_id"]),
        "left": x,
        "top": y,
        "width": w,
        "height": h,
    }


def make_class_diagram(model_id, name):
    did = nid("CD")
    diag = {
        "_type": "UMLClassDiagram",
        "_id": did,
        "_parent": ref(model_id),
        "name": name,
        "ownedViews": [],
        "defaultDiagram": True,
    }
    return diag, did


def make_usecase_diagram(model_id, name):
    did = nid("UCD")
    diag = {
        "_type": "UMLUseCaseDiagram",
        "_id": did,
        "_parent": ref(model_id),
        "name": name,
        "ownedViews": [],
        "defaultDiagram": True,
    }
    return diag, did


def make_component_diagram(model_id, name):
    did = nid("CMD")
    diag = {
        "_type": "UMLComponentDiagram",
        "_id": did,
        "_parent": ref(model_id),
        "name": name,
        "ownedViews": [],
        "defaultDiagram": True,
    }
    return diag, did


def save_mdj(project, filename):
    path = os.path.join(OUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(project, f, indent=2, ensure_ascii=False)
    print(f"OK  {filename}")


# ===================== 1. ER / DER =====================
def build_er():
    project, model = make_project("ProyDemo - ER / DER")
    mid = model["_id"]

    tables = {
        "users": [
            {"name": "id", "type": "UUID", "pk": True},
            {"name": "email", "type": "VARCHAR(320) UK"},
            {"name": "password_hash", "type": "VARCHAR(255)"},
            {"name": "first_name", "type": "VARCHAR(80)"},
            {"name": "last_name", "type": "VARCHAR(80)"},
            {"name": "role", "type": "ENUM"},
            {"name": "is_active", "type": "BOOLEAN"},
            {"name": "is_email_verified", "type": "BOOLEAN"},
            {"name": "created_at", "type": "TIMESTAMPTZ"},
            {"name": "updated_at", "type": "TIMESTAMPTZ"},
        ],
        "auth_sessions": [
            {"name": "id", "type": "UUID", "pk": True},
            {"name": "user_id", "type": "UUID FK"},
            {"name": "refresh_token_hash", "type": "VARCHAR(255)"},
            {"name": "user_agent", "type": "VARCHAR(255)"},
            {"name": "ip_address", "type": "VARCHAR(64)"},
            {"name": "expires_at", "type": "TIMESTAMPTZ"},
            {"name": "is_revoked", "type": "BOOLEAN"},
            {"name": "created_at", "type": "TIMESTAMPTZ"},
        ],
        "quizzes": [
            {"name": "id", "type": "UUID", "pk": True},
            {"name": "author_id", "type": "UUID FK"},
            {"name": "title", "type": "VARCHAR(160)"},
            {"name": "description", "type": "TEXT"},
            {"name": "category", "type": "ENUM"},
            {"name": "difficulty", "type": "ENUM"},
            {"name": "language", "type": "ENUM"},
            {"name": "source", "type": "VARCHAR(32)"},
            {"name": "is_published", "type": "BOOLEAN"},
            {"name": "created_at", "type": "TIMESTAMPTZ"},
        ],
        "questions": [
            {"name": "id", "type": "UUID", "pk": True},
            {"name": "quiz_id", "type": "UUID FK"},
            {"name": "text", "type": "TEXT"},
            {"name": "type", "type": "ENUM"},
            {"name": "options", "type": "JSONB"},
            {"name": "correct_answer", "type": "TEXT"},
            {"name": "difficulty", "type": "ENUM"},
            {"name": "position", "type": "INT"},
        ],
        "quiz_sessions": [
            {"name": "id", "type": "UUID", "pk": True},
            {"name": "user_id", "type": "UUID FK"},
            {"name": "quiz_id", "type": "UUID FK"},
            {"name": "status", "type": "ENUM"},
            {"name": "answers", "type": "JSONB"},
            {"name": "total_score", "type": "FLOAT"},
            {"name": "correct_count", "type": "INT"},
            {"name": "started_at", "type": "TIMESTAMPTZ"},
            {"name": "completed_at", "type": "TIMESTAMPTZ"},
        ],
        "scores": [
            {"name": "id", "type": "UUID", "pk": True},
            {"name": "user_id", "type": "UUID FK"},
            {"name": "quiz_id", "type": "UUID FK"},
            {"name": "session_id", "type": "UUID FK"},
            {"name": "points", "type": "FLOAT"},
            {"name": "correct_count", "type": "INT"},
            {"name": "total_questions", "type": "INT"},
            {"name": "accuracy", "type": "FLOAT"},
            {"name": "created_at", "type": "TIMESTAMPTZ"},
        ],
        "achievements": [
            {"name": "id", "type": "UUID", "pk": True},
            {"name": "user_id", "type": "UUID FK"},
            {"name": "code", "type": "ENUM"},
            {"name": "title", "type": "VARCHAR(160)"},
            {"name": "description", "type": "TEXT"},
            {"name": "unlocked_at", "type": "TIMESTAMPTZ"},
        ],
        "notifications": [
            {"name": "id", "type": "UUID", "pk": True},
            {"name": "user_id", "type": "UUID FK"},
            {"name": "type", "type": "VARCHAR(64)"},
            {"name": "title", "type": "VARCHAR(255)"},
            {"name": "body", "type": "TEXT"},
            {"name": "is_read", "type": "BOOLEAN"},
            {"name": "read_at", "type": "TIMESTAMPTZ"},
            {"name": "created_at", "type": "TIMESTAMPTZ"},
        ],
    }

    # Mapeo tabla → patrones DDD aplicados (visibles en stereotype y documentation)
    ddd_patterns = {
        "users": ["Aggregate Root"],
        "auth_sessions": ["Entity", "State Pattern"],
        "quizzes": ["Aggregate Root"],
        "questions": ["Entity"],
        "quiz_sessions": ["Aggregate Root", "State Pattern"],
        "scores": ["Value Object"],
        "achievements": ["Entity", "Domain Event"],
        "notifications": ["Entity", "Observer"],
    }

    classes = {}
    for tname, attrs in tables.items():
        c = make_class(mid, tname, stereotype="Table", attrs=attrs,
                       patterns=ddd_patterns.get(tname))
        classes[tname] = c
        model["ownedElements"].append(c)

    rels = [
        ("users", "auth_sessions", "tiene", "1", "*"),
        ("users", "quizzes", "autor_de", "1", "*"),
        ("users", "quiz_sessions", "juega", "1", "*"),
        ("users", "scores", "obtiene", "1", "*"),
        ("users", "achievements", "desbloquea", "1", "*"),
        ("users", "notifications", "recibe", "1", "*"),
        ("quizzes", "questions", "contiene", "1", "*"),
        ("quizzes", "quiz_sessions", "jugado_en", "1", "*"),
        ("quizzes", "scores", "evaluado_en", "1", "*"),
        ("quiz_sessions", "scores", "genera", "1", "1"),
    ]
    rel_objs = []
    for src, tgt, name, mf, mt in rels:
        a = make_association(mid, classes[src], classes[tgt], name=name, mult_from=mf, mult_to=mt)
        model["ownedElements"].append(a)
        rel_objs.append((a, src, tgt))

    diag, did = make_class_diagram(mid, "Diagrama ER (Crow's Foot)")
    model["ownedElements"].append(diag)
    positions = {
        "users":         (50, 50),
        "auth_sessions": (320, 50),
        "quizzes":       (590, 50),
        "questions":     (860, 50),
        "quiz_sessions": (50, 380),
        "scores":        (320, 380),
        "achievements":  (590, 380),
        "notifications": (860, 380),
    }
    cls_views = {}
    for tname, (x, y) in positions.items():
        v = make_class_view(did, classes[tname], x, y, w=240, h=280)
        diag["ownedViews"].append(v)
        cls_views[tname] = v

    # Edge views — relaciones visibles
    for assoc, src, tgt in rel_objs:
        diag["ownedViews"].append(make_assoc_view(did, assoc, cls_views[src], cls_views[tgt]))

    # Nota global de patrones DDD aplicados
    note = make_note(mid,
        "Patrones DDD/Tácticos aplicados:\n"
        "- Aggregate Root: users, quizzes, quiz_sessions\n"
        "- Entity: questions, achievements, notifications, auth_sessions\n"
        "- Value Object: scores\n"
        "- State Pattern: quiz_sessions.status, auth_sessions (active/revoked/expired)\n"
        "- Domain Event: achievements (unlock), notifications (push)\n"
        "- Observer: notifications subscription\n"
        "Notación: Crow's Foot. PK/FK diferenciadas. UK = UNIQUE."
    )
    model["ownedElements"].append(note)
    diag["ownedViews"].append(make_note_view(did, note, 50, 650, w=900, h=120))

    save_mdj(project, "01_ER_DER.mdj")


# ===================== 2. Modelo Relacional PostgreSQL =====================
def build_relational():
    """Modelo Relacional con tipos PostgreSQL reales, índices, UNIQUE, ENUMS, JSONB, UUID."""
    project, model = make_project("ProyDemo - Modelo Relacional PostgreSQL")
    mid = model["_id"]

    tables = {
        "users": [
            {"name": "id PK", "type": "UUID DEFAULT gen_random_uuid()"},
            {"name": "email UK", "type": "VARCHAR(320) NOT NULL UNIQUE"},
            {"name": "password_hash", "type": "VARCHAR(255) NOT NULL"},
            {"name": "first_name", "type": "VARCHAR(80) NOT NULL"},
            {"name": "last_name", "type": "VARCHAR(80) NOT NULL"},
            {"name": "role", "type": "user_role_enum NOT NULL"},
            {"name": "is_active", "type": "BOOLEAN DEFAULT true"},
            {"name": "is_email_verified", "type": "BOOLEAN DEFAULT false"},
            {"name": "metadata", "type": "JSONB"},
            {"name": "created_at", "type": "TIMESTAMPTZ DEFAULT NOW()"},
            {"name": "updated_at", "type": "TIMESTAMPTZ DEFAULT NOW()"},
            {"name": "idx_users_email", "type": "INDEX UNIQUE"},
            {"name": "idx_users_role", "type": "INDEX BTREE"},
        ],
        "auth_sessions": [
            {"name": "id PK", "type": "UUID DEFAULT gen_random_uuid()"},
            {"name": "user_id FK", "type": "UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE"},
            {"name": "refresh_token_hash UK", "type": "VARCHAR(255) UNIQUE NOT NULL"},
            {"name": "user_agent", "type": "VARCHAR(255)"},
            {"name": "ip_address", "type": "INET"},
            {"name": "expires_at", "type": "TIMESTAMPTZ NOT NULL"},
            {"name": "is_revoked", "type": "BOOLEAN DEFAULT false"},
            {"name": "created_at", "type": "TIMESTAMPTZ DEFAULT NOW()"},
            {"name": "idx_auth_sessions_user", "type": "INDEX BTREE"},
            {"name": "idx_auth_sessions_token", "type": "INDEX UNIQUE"},
        ],
        "quizzes": [
            {"name": "id PK", "type": "UUID DEFAULT gen_random_uuid()"},
            {"name": "author_id FK", "type": "UUID REFERENCES users(id)"},
            {"name": "title", "type": "VARCHAR(160) NOT NULL"},
            {"name": "description", "type": "TEXT"},
            {"name": "category", "type": "quiz_category_enum NOT NULL"},
            {"name": "difficulty", "type": "difficulty_enum NOT NULL"},
            {"name": "language", "type": "language_enum DEFAULT 'es'"},
            {"name": "source", "type": "VARCHAR(32)"},
            {"name": "is_published", "type": "BOOLEAN DEFAULT false"},
            {"name": "tags", "type": "JSONB"},
            {"name": "created_at", "type": "TIMESTAMPTZ DEFAULT NOW()"},
            {"name": "idx_quizzes_author", "type": "INDEX BTREE"},
            {"name": "idx_quizzes_category_pub", "type": "INDEX COMPOSITE"},
        ],
        "questions": [
            {"name": "id PK", "type": "UUID DEFAULT gen_random_uuid()"},
            {"name": "quiz_id FK", "type": "UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE"},
            {"name": "text", "type": "TEXT NOT NULL"},
            {"name": "type", "type": "question_type_enum NOT NULL"},
            {"name": "options", "type": "JSONB"},
            {"name": "correct_answer", "type": "TEXT NOT NULL"},
            {"name": "difficulty", "type": "difficulty_enum"},
            {"name": "position", "type": "INT NOT NULL"},
            {"name": "idx_questions_quiz_pos", "type": "INDEX UNIQUE COMPOSITE"},
        ],
        "quiz_sessions": [
            {"name": "id PK", "type": "UUID DEFAULT gen_random_uuid()"},
            {"name": "user_id FK", "type": "UUID NOT NULL REFERENCES users(id)"},
            {"name": "quiz_id FK", "type": "UUID NOT NULL REFERENCES quizzes(id)"},
            {"name": "status", "type": "session_status_enum NOT NULL"},
            {"name": "answers", "type": "JSONB NOT NULL DEFAULT '[]'"},
            {"name": "total_score", "type": "NUMERIC(5,2)"},
            {"name": "correct_count", "type": "INT DEFAULT 0"},
            {"name": "started_at", "type": "TIMESTAMPTZ DEFAULT NOW()"},
            {"name": "completed_at", "type": "TIMESTAMPTZ"},
            {"name": "idx_qs_user_status", "type": "INDEX COMPOSITE"},
        ],
        "scores": [
            {"name": "id PK", "type": "UUID DEFAULT gen_random_uuid()"},
            {"name": "user_id FK", "type": "UUID NOT NULL REFERENCES users(id)"},
            {"name": "quiz_id FK", "type": "UUID NOT NULL REFERENCES quizzes(id)"},
            {"name": "session_id FK", "type": "UUID UNIQUE REFERENCES quiz_sessions(id)"},
            {"name": "points", "type": "NUMERIC(6,2) NOT NULL"},
            {"name": "correct_count", "type": "INT NOT NULL"},
            {"name": "total_questions", "type": "INT NOT NULL"},
            {"name": "accuracy", "type": "NUMERIC(5,4) NOT NULL CHECK (accuracy>=0 AND accuracy<=1)"},
            {"name": "created_at", "type": "TIMESTAMPTZ DEFAULT NOW()"},
            {"name": "idx_scores_leaderboard", "type": "INDEX (quiz_id, points DESC)"},
        ],
        "achievements": [
            {"name": "id PK", "type": "UUID DEFAULT gen_random_uuid()"},
            {"name": "user_id FK", "type": "UUID NOT NULL REFERENCES users(id)"},
            {"name": "code", "type": "achievement_code_enum NOT NULL"},
            {"name": "title", "type": "VARCHAR(160) NOT NULL"},
            {"name": "description", "type": "TEXT"},
            {"name": "unlocked_at", "type": "TIMESTAMPTZ DEFAULT NOW()"},
            {"name": "uk_user_code", "type": "UNIQUE (user_id, code)"},
        ],
        "notifications": [
            {"name": "id PK", "type": "UUID DEFAULT gen_random_uuid()"},
            {"name": "user_id FK", "type": "UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE"},
            {"name": "type", "type": "VARCHAR(64) NOT NULL"},
            {"name": "title", "type": "VARCHAR(255) NOT NULL"},
            {"name": "body", "type": "TEXT"},
            {"name": "payload", "type": "JSONB"},
            {"name": "is_read", "type": "BOOLEAN DEFAULT false"},
            {"name": "read_at", "type": "TIMESTAMPTZ"},
            {"name": "created_at", "type": "TIMESTAMPTZ DEFAULT NOW()"},
            {"name": "idx_notif_user_unread", "type": "INDEX PARTIAL (user_id) WHERE NOT is_read"},
        ],
    }

    ddd_patterns = {
        "users": ["Aggregate Root"],
        "auth_sessions": ["Entity", "State Pattern"],
        "quizzes": ["Aggregate Root"],
        "questions": ["Entity"],
        "quiz_sessions": ["Aggregate Root", "State Pattern"],
        "scores": ["Value Object"],
        "achievements": ["Entity", "Domain Event"],
        "notifications": ["Entity", "Observer"],
    }

    classes = {}
    for tname, attrs in tables.items():
        c = make_class(mid, tname, stereotype="PostgreSQL Table", attrs=attrs,
                       patterns=ddd_patterns.get(tname))
        classes[tname] = c
        model["ownedElements"].append(c)

    rels = [
        ("users", "auth_sessions", "posee", "1", "*"),
        ("users", "quizzes", "autor_de", "1", "*"),
        ("users", "quiz_sessions", "juega", "1", "*"),
        ("users", "scores", "obtiene", "1", "*"),
        ("users", "achievements", "desbloquea", "1", "*"),
        ("users", "notifications", "recibe", "1", "*"),
        ("quizzes", "questions", "contiene", "1", "*"),
        ("quizzes", "quiz_sessions", "jugado_en", "1", "*"),
        ("quizzes", "scores", "evaluado_en", "1", "*"),
        ("quiz_sessions", "scores", "genera", "1", "1"),
    ]
    rel_objs = []
    for src, tgt, name, mf, mt in rels:
        a = make_association(mid, classes[src], classes[tgt], name=name, mult_from=mf, mult_to=mt)
        model["ownedElements"].append(a)
        rel_objs.append((a, src, tgt))

    diag, did = make_class_diagram(mid, "Modelo Relacional PostgreSQL")
    model["ownedElements"].append(diag)
    positions = {
        "users":         (50, 50),
        "auth_sessions": (340, 50),
        "quizzes":       (630, 50),
        "questions":     (920, 50),
        "quiz_sessions": (50, 460),
        "scores":        (340, 460),
        "achievements":  (630, 460),
        "notifications": (920, 460),
    }
    cls_views = {}
    for tname, (x, y) in positions.items():
        v = make_class_view(did, classes[tname], x, y, w=260, h=360)
        diag["ownedViews"].append(v)
        cls_views[tname] = v

    for assoc, src, tgt in rel_objs:
        diag["ownedViews"].append(make_assoc_view(did, assoc, cls_views[src], cls_views[tgt]))

    note = make_note(mid,
        "Modelo Relacional PostgreSQL 18:\n"
        "- Tipos: UUID, JSONB, TIMESTAMPTZ, NUMERIC, INET, ENUM\n"
        "- Restricciones: PK, FK ON DELETE CASCADE, UNIQUE, CHECK\n"
        "- Índices: BTREE, COMPOSITE, PARTIAL, UNIQUE\n"
        "- ENUMs: user_role_enum, quiz_category_enum, difficulty_enum,\n"
        "  language_enum, question_type_enum, session_status_enum,\n"
        "  achievement_code_enum\n"
        "Patrones: Repository (TypeORM), Unit of Work (QueryRunner),\n"
        "Specification (filtros), Identity Map (TypeORM)"
    )
    model["ownedElements"].append(note)
    diag["ownedViews"].append(make_note_view(did, note, 50, 820, w=1050, h=160))

    save_mdj(project, "02_Modelo_Relacional.mdj")


# ===================== 3. Diagrama de Normalización =====================
def build_normalization():
    """Etapas 1FN, 2FN, 3FN y BCNF aplicadas a tablas principales."""
    project, model = make_project("ProyDemo - Normalización 1FN/2FN/3FN/BCNF")
    mid = model["_id"]

    # 1FN — tabla cruda con valores atómicos (sin grupos repetidos)
    fn1_users = make_class(mid, "users [1FN]", stereotype="1FN", attrs=[
        {"name": "id", "type": "UUID PK"},
        {"name": "email", "type": "VARCHAR"},
        {"name": "first_name", "type": "VARCHAR (separado)"},
        {"name": "last_name", "type": "VARCHAR (separado)"},
        {"name": "role", "type": "ENUM (atómico)"},
        {"name": "is_active", "type": "BOOLEAN"},
        {"name": "created_at", "type": "TIMESTAMPTZ"},
    ], documentation="1FN cumplida: cada atributo es atómico, no hay listas ni grupos repetidos. full_name se separa en first_name/last_name.")

    fn1_quizzes = make_class(mid, "quizzes [1FN]", stereotype="1FN", attrs=[
        {"name": "id", "type": "UUID PK"},
        {"name": "title", "type": "VARCHAR"},
        {"name": "author_id", "type": "UUID FK"},
        {"name": "category", "type": "ENUM"},
        {"name": "tags", "type": "JSONB (atómico estructurado)"},
    ], documentation="1FN: tags como JSONB cumple atomicidad lógica (estructura indivisible a nivel de dominio).")

    # 2FN — eliminar dependencias parciales sobre claves compuestas
    fn2_questions = make_class(mid, "questions [2FN]", stereotype="2FN", attrs=[
        {"name": "id", "type": "UUID PK"},
        {"name": "quiz_id", "type": "UUID FK"},
        {"name": "text", "type": "TEXT"},
        {"name": "type", "type": "ENUM"},
        {"name": "position", "type": "INT"},
    ], documentation="2FN: ya estaba en 1FN. PK simple (id). Atributos no clave dependen totalmente de id. Sin dependencias parciales.")

    fn2_session_answers = make_class(mid, "quiz_session_answers [2FN]", stereotype="2FN", attrs=[
        {"name": "session_id", "type": "UUID PK FK"},
        {"name": "question_id", "type": "UUID PK FK"},
        {"name": "answer_value", "type": "TEXT"},
        {"name": "is_correct", "type": "BOOLEAN"},
        {"name": "answered_at", "type": "TIMESTAMPTZ"},
    ], documentation="2FN: PK compuesta (session_id, question_id). Todos los atributos no clave dependen de AMBAS partes de la PK. (Nota: en runtime usamos JSONB en quiz_sessions.answers — desnormalización controlada para rendimiento de lectura.)")

    # 3FN — eliminar dependencias transitivas
    fn3_users = make_class(mid, "users [3FN]", stereotype="3FN", attrs=[
        {"name": "id", "type": "UUID PK"},
        {"name": "email", "type": "VARCHAR UK"},
        {"name": "password_hash", "type": "VARCHAR"},
        {"name": "role", "type": "ENUM"},
    ], documentation="3FN: atributos no clave dependen sólo de la PK. Sin dependencias transitivas. role separado de permisos detallados (que iría en tabla aparte si se necesitara RBAC fino).")

    fn3_scores = make_class(mid, "scores [3FN]", stereotype="3FN", attrs=[
        {"name": "id", "type": "UUID PK"},
        {"name": "user_id", "type": "UUID FK"},
        {"name": "quiz_id", "type": "UUID FK"},
        {"name": "session_id", "type": "UUID FK UK"},
        {"name": "points", "type": "NUMERIC"},
        {"name": "accuracy", "type": "NUMERIC"},
    ], documentation="3FN: accuracy depende de session_id (correct_count/total_questions). Se almacena por rendimiento — desnormalización controlada.")

    # BCNF — todo determinante es superclave
    bcnf_auth = make_class(mid, "auth_sessions [BCNF]", stereotype="BCNF", attrs=[
        {"name": "id", "type": "UUID PK"},
        {"name": "user_id", "type": "UUID FK"},
        {"name": "refresh_token_hash", "type": "VARCHAR UK"},
        {"name": "expires_at", "type": "TIMESTAMPTZ"},
        {"name": "is_revoked", "type": "BOOLEAN"},
    ], documentation="BCNF: refresh_token_hash es superclave (UNIQUE) y único determinante adicional. Todo determinante es superclave. Cumple BCNF.")

    bcnf_achievements = make_class(mid, "achievements [BCNF]", stereotype="BCNF", attrs=[
        {"name": "id", "type": "UUID PK"},
        {"name": "user_id", "type": "UUID FK"},
        {"name": "code", "type": "ENUM"},
        {"name": "uk_user_code", "type": "UNIQUE (user_id, code)"},
    ], documentation="BCNF: clave compuesta (user_id, code) es superclave; no hay dependencias anómalas.")

    all_cls = [fn1_users, fn1_quizzes, fn2_questions, fn2_session_answers,
               fn3_users, fn3_scores, bcnf_auth, bcnf_achievements]
    for c in all_cls:
        model["ownedElements"].append(c)

    # Flechas de progresión 1FN → 2FN → 3FN → BCNF
    progression = [
        (fn1_users, fn3_users, "refina a 3FN"),
        (fn1_quizzes, fn2_questions, "extrae a 2FN"),
        (fn2_session_answers, fn3_scores, "refina a 3FN"),
        (fn3_users, bcnf_auth, "asegura BCNF"),
        (fn3_scores, bcnf_achievements, "asegura BCNF"),
    ]
    prog_deps = []
    for src, tgt, name in progression:
        d = make_dependency(mid, src, tgt, stereotype="normalizes")
        d["name"] = name
        model["ownedElements"].append(d)
        prog_deps.append((d, src, tgt))

    diag, did = make_class_diagram(mid, "Normalización 1FN/2FN/3FN/BCNF")
    model["ownedElements"].append(diag)

    layout = {
        fn1_users["_id"]: (50, 50),
        fn1_quizzes["_id"]: (340, 50),
        fn2_questions["_id"]: (50, 340),
        fn2_session_answers["_id"]: (340, 340),
        fn3_users["_id"]: (50, 630),
        fn3_scores["_id"]: (340, 630),
        bcnf_auth["_id"]: (50, 920),
        bcnf_achievements["_id"]: (340, 920),
    }
    cls_views = {}
    for c in all_cls:
        x, y = layout[c["_id"]]
        cv = make_class_view(did, c, x, y, w=260, h=260)
        diag["ownedViews"].append(cv)
        cls_views[c["_id"]] = cv

    for dep, src, tgt in prog_deps:
        diag["ownedViews"].append(make_dep_view(did, dep, cls_views[src["_id"]], cls_views[tgt["_id"]]))

    note = make_note(mid,
        "Proceso de normalización ProyDemo:\n"
        "1FN: atomicidad de atributos. JSONB como tipo atómico estructurado.\n"
        "2FN: 1FN + sin dependencias parciales sobre claves compuestas.\n"
        "3FN: 2FN + sin dependencias transitivas (no clave → no clave).\n"
        "BCNF: 3FN + todo determinante funcional es superclave.\n\n"
        "Desnormalización controlada justificada:\n"
        "- quiz_sessions.answers JSONB en vez de tabla quiz_session_answers:\n"
        "  motivo = lectura masiva, escritura unitaria, atomicidad transaccional.\n"
        "- scores.accuracy calculado y almacenado: evita recálculo en leaderboard.\n"
        "- notifications.payload JSONB: estructura heterogénea por type.\n\n"
        "Cada desnormalización requiere CHECK constraints e índices específicos."
    )
    model["ownedElements"].append(note)
    diag["ownedViews"].append(make_note_view(did, note, 600, 50, w=440, h=400))

    save_mdj(project, "03_Normalizacion.mdj")


# ===================== 4. Diagrama de Clases UML =====================
def build_class_diagram():
    project, model = make_project("ProyDemo - Clases UML (Hexagonal)")
    mid = model["_id"]

    # ----- Capa Dominio (verde claro) -----
    user_cls = make_class(mid, "User", stereotype="Domain",
        patterns=["Aggregate Root", "Entity"], attrs=[
        {"name": "id", "type": "UUID", "pk": True},
        {"name": "email", "type": "Email"},
        {"name": "passwordHash", "type": "string"},
        {"name": "firstName", "type": "string"},
        {"name": "lastName", "type": "string"},
        {"name": "role", "type": "Role"},
        {"name": "isActive", "type": "boolean"},
        {"name": "isEmailVerified", "type": "boolean"},
    ], documentation="Raíz de agregado Usuario. Encapsula invariantes de identidad y autenticación.")

    email_vo = make_class(mid, "Email", stereotype="Domain",
        patterns=["Value Object"], attrs=[
        {"name": "value", "type": "string"},
    ], documentation="Value Object inmutable. Validación RFC 5322 en constructor.")

    password_vo = make_class(mid, "Password", stereotype="Domain",
        patterns=["Value Object"], attrs=[
        {"name": "hash", "type": "string"},
    ], documentation="Value Object con hash bcrypt. Compara mediante constant-time.")

    session_cls = make_class(mid, "AuthSession", stereotype="Domain",
        patterns=["Entity", "State Pattern"], attrs=[
        {"name": "id", "type": "UUID", "pk": True},
        {"name": "userId", "type": "UUID"},
        {"name": "refreshTokenHash", "type": "string"},
        {"name": "expiresAt", "type": "Date"},
        {"name": "state", "type": "SessionState"},
    ], documentation="Entidad con máquina de estados ACTIVA/REFRESCADA/REVOCADA/EXPIRADA.")

    token_pair = make_class(mid, "TokenPair", stereotype="Domain",
        patterns=["Value Object"], attrs=[
        {"name": "accessToken", "type": "string"},
        {"name": "refreshToken", "type": "string"},
        {"name": "accessExpiresIn", "type": "number"},
    ])

    quiz_cls = make_class(mid, "Quiz", stereotype="Domain",
        patterns=["Aggregate Root"], attrs=[
        {"name": "id", "type": "UUID", "pk": True},
        {"name": "title", "type": "string"},
        {"name": "questions", "type": "Question[]"},
    ], documentation="Aggregate Root del bounded context Evaluación.")

    quiz_session_cls = make_class(mid, "QuizSession", stereotype="Domain",
        patterns=["Aggregate Root", "State Pattern"], attrs=[
        {"name": "id", "type": "UUID", "pk": True},
        {"name": "status", "type": "SessionStatus"},
        {"name": "score", "type": "Score"},
    ], documentation="Intento. Estados EN_PROGRESO/COMPLETADO/ABANDONADO.")

    score_vo = make_class(mid, "Score", stereotype="Domain",
        patterns=["Value Object"], attrs=[
        {"name": "points", "type": "number"},
        {"name": "accuracy", "type": "number"},
    ])

    domain_event = make_class(mid, "DomainEvent", stereotype="Domain",
        patterns=["Domain Event"], attrs=[
        {"name": "occurredOn", "type": "Date"},
        {"name": "aggregateId", "type": "UUID"},
    ], documentation="Evento de dominio publicado por agregados. Ej: IntentoCompletado, EvaluacionPublicada.")

    # ----- Puertos (Domain — interfaces) -----
    iuser_repo = make_class(mid, "IUserRepository", stereotype="Port",
        patterns=["Repository", "Specification"],
        documentation="Puerto de salida. Implementación en infraestructura vía TypeORM.")
    iauth_repo = make_class(mid, "IAuthRepository", stereotype="Port",
        patterns=["Repository"])
    itoken_svc = make_class(mid, "ITokenService", stereotype="Port",
        patterns=["Strategy"],
        documentation="Puerto para estrategias de tokens (JWT, Paseto, etc.).")
    ioauth = make_class(mid, "IOAuthVerifier", stereotype="Port",
        patterns=["Strategy"],
        documentation="Puerto Strategy: verificadores OAuth intercambiables (Google, Microsoft).")
    iai_port = make_class(mid, "IAIPort", stereotype="Port",
        patterns=["Adapter", "Anti-Corruption Layer"],
        documentation="Puerto al microservicio IA FastAPI. ACL entre dominios.")
    inotif_port = make_class(mid, "INotificationPort", stereotype="Port",
        patterns=["Observer", "Publisher-Subscriber"])

    # ----- Capa Aplicación (naranja claro) — Casos de Uso -----
    login_uc = make_class(mid, "LoginUseCase", stereotype="Application",
        patterns=["Use Case", "Command", "Facade"],
        documentation="Orquesta autenticación local. CQRS Command handler.")
    register_uc = make_class(mid, "RegisterUseCase", stereotype="Application",
        patterns=["Use Case", "Command"])
    refresh_uc = make_class(mid, "RefreshTokenUseCase", stereotype="Application",
        patterns=["Use Case", "Command"])
    logout_uc = make_class(mid, "LogoutUseCase", stereotype="Application",
        patterns=["Use Case", "Command"])
    oauth_uc = make_class(mid, "OAuthLoginUseCase", stereotype="Application",
        patterns=["Use Case", "Command", "Strategy"],
        documentation="Resuelve verificador OAuth en tiempo de ejecución (Strategy + Factory).")
    grade_uc = make_class(mid, "GradeAttemptUseCase", stereotype="Application",
        patterns=["Use Case", "Command", "Saga", "Template Method"],
        documentation="Saga: invoca IA, calcula score, dispara eventos, notifica.")
    list_quizzes_uc = make_class(mid, "ListQuizzesQuery", stereotype="Application",
        patterns=["Use Case", "Query"],
        documentation="CQRS Query con caching (Proxy/Redis).")

    # ----- Capa Infraestructura (azul claro) — Adapters -----
    user_repo = make_class(mid, "TypeOrmUserRepository", stereotype="Infrastructure",
        patterns=["Adapter", "Repository", "Unit of Work"],
        documentation="Implementa IUserRepository con TypeORM + QueryRunner para transacciones.")
    auth_repo = make_class(mid, "TypeOrmAuthRepository", stereotype="Infrastructure",
        patterns=["Adapter", "Repository"])
    jwt_svc = make_class(mid, "JwtTokenService", stereotype="Infrastructure",
        patterns=["Adapter", "Strategy"],
        documentation="Implementación JWT (HS256/RS256). Reemplazable por Paseto.")
    google_v = make_class(mid, "GoogleOAuthVerifier", stereotype="Infrastructure",
        patterns=["Adapter", "Strategy"])
    ms_v = make_class(mid, "MicrosoftOAuthVerifier", stereotype="Infrastructure",
        patterns=["Adapter", "Strategy"])
    registry = make_class(mid, "OAuthVerifierRegistry", stereotype="Infrastructure",
        patterns=["Factory Method", "Singleton"],
        documentation="Factory de verificadores OAuth indexados por provider.")
    fastapi_client = make_class(mid, "FastApiAIClient", stereotype="Infrastructure",
        patterns=["Adapter", "Circuit Breaker", "Retry", "Anti-Corruption Layer"],
        documentation="Cliente HTTP a FastAPI con resiliencia.")
    redis_cache = make_class(mid, "RedisCacheProxy", stereotype="Infrastructure",
        patterns=["Proxy", "Decorator"],
        documentation="Capa de caché sobre repositorios.")
    bull_publisher = make_class(mid, "BullEventPublisher", stereotype="Infrastructure",
        patterns=["Adapter", "Observer", "Publisher-Subscriber", "Outbox"],
        documentation="Publicador de eventos vía Bull. Implementa Outbox.")
    ws_gateway = make_class(mid, "NotificationsGateway", stereotype="Infrastructure",
        patterns=["Adapter", "Observer", "Publisher-Subscriber"],
        documentation="WebSocket gateway NestJS. Emite a clientes suscritos.")

    # ----- Capa Presentación (rosa claro) — Controllers + Guards -----
    auth_ctrl = make_class(mid, "AuthController", stereotype="Presentation",
        patterns=["Controller", "Facade", "DTO"],
        documentation="Endpoint REST. Decoradores NestJS @Controller @Post.")
    quiz_ctrl = make_class(mid, "QuizController", stereotype="Presentation",
        patterns=["Controller", "Facade", "DTO"])
    jwt_guard = make_class(mid, "JwtAuthGuard", stereotype="Presentation",
        patterns=["Decorator", "Chain of Responsibility"],
        documentation="Guard global. Cadena de responsabilidad sobre cada request.")
    role_guard = make_class(mid, "RolesGuard", stereotype="Presentation",
        patterns=["Decorator", "Chain of Responsibility"])

    # ===== Operaciones (métodos) por clase =====
    add_ops(user_cls, [
        ("verifyPassword", "boolean", [{"name": "raw", "type": "string"}]),
        ("changeEmail", "void", [{"name": "newEmail", "type": "Email"}]),
        ("activate", "void", []),
        ("deactivate", "void", []),
        ("verifyEmail", "void", []),
        ("hasRole", "boolean", [{"name": "role", "type": "Role"}]),
    ])
    add_ops(email_vo, [
        ("create", "Email", [{"name": "value", "type": "string"}]),
        ("equals", "boolean", [{"name": "other", "type": "Email"}]),
        ("toString", "string", []),
    ])
    add_ops(password_vo, [
        ("hash", "Password", [{"name": "raw", "type": "string"}]),
        ("matches", "boolean", [{"name": "raw", "type": "string"}]),
    ])
    add_ops(session_cls, [
        ("refresh", "TokenPair", []),
        ("revoke", "void", []),
        ("isExpired", "boolean", []),
        ("canRefresh", "boolean", []),
    ])
    add_ops(token_pair, [
        ("create", "TokenPair", [{"name": "access", "type": "string"}, {"name": "refresh", "type": "string"}]),
    ])
    add_ops(quiz_cls, [
        ("addQuestion", "void", [{"name": "q", "type": "Question"}]),
        ("removeQuestion", "void", [{"name": "id", "type": "UUID"}]),
        ("publish", "void", []),
        ("unpublish", "void", []),
    ])
    add_ops(quiz_session_cls, [
        ("answer", "void", [{"name": "questionId", "type": "UUID"}, {"name": "value", "type": "string"}]),
        ("complete", "Score", []),
        ("abandon", "void", []),
        ("isCompleted", "boolean", []),
    ])
    add_ops(score_vo, [
        ("calculate", "Score", [{"name": "answers", "type": "Answer[]"}]),
    ])
    add_ops(domain_event, [
        ("eventName", "string", []),
    ])

    # Puertos (interfaces — métodos abstractos)
    iuser_repo["stereotype"] = "Port, Repository, Specification"
    add_ops(iuser_repo, [
        ("findById", "Promise<User>", [{"name": "id", "type": "UUID"}]),
        ("findByEmail", "Promise<User>", [{"name": "email", "type": "Email"}]),
        ("save", "Promise<User>", [{"name": "user", "type": "User"}]),
        ("findBy", "Promise<User[]>", [{"name": "spec", "type": "Specification"}]),
    ])
    add_ops(iauth_repo, [
        ("create", "Promise<AuthSession>", [{"name": "s", "type": "AuthSession"}]),
        ("findByRefreshHash", "Promise<AuthSession>", [{"name": "hash", "type": "string"}]),
        ("revoke", "Promise<void>", [{"name": "id", "type": "UUID"}]),
    ])
    add_ops(itoken_svc, [
        ("sign", "string", [{"name": "payload", "type": "JwtPayload"}]),
        ("verify", "JwtPayload", [{"name": "token", "type": "string"}]),
        ("generatePair", "TokenPair", [{"name": "userId", "type": "UUID"}]),
    ])
    add_ops(ioauth, [
        ("verifyIdToken", "Promise<VerifiedOAuthProfile>", [{"name": "idToken", "type": "string"}]),
        ("supports", "boolean", [{"name": "provider", "type": "string"}]),
    ])
    add_ops(iai_port, [
        ("gradeOpenAnswer", "Promise<GradeResult>", [{"name": "text", "type": "string"}, {"name": "rubric", "type": "Rubric"}]),
        ("generateQuiz", "Promise<Quiz>", [{"name": "topic", "type": "string"}]),
        ("generateFeedback", "Promise<Feedback>", [{"name": "ctx", "type": "Context"}]),
    ])
    add_ops(inotif_port, [
        ("notify", "Promise<void>", [{"name": "userId", "type": "UUID"}, {"name": "event", "type": "DomainEvent"}]),
        ("subscribe", "void", [{"name": "topic", "type": "string"}, {"name": "handler", "type": "Handler"}]),
    ])

    # Use Cases
    add_ops(login_uc, [
        ("execute", "Promise<AuthResponseDto>", [{"name": "dto", "type": "LoginDto"}]),
    ])
    add_ops(register_uc, [
        ("execute", "Promise<AuthResponseDto>", [{"name": "dto", "type": "RegisterDto"}]),
    ])
    add_ops(refresh_uc, [
        ("execute", "Promise<TokenPair>", [{"name": "refreshToken", "type": "string"}]),
    ])
    add_ops(logout_uc, [
        ("execute", "Promise<void>", [{"name": "sessionId", "type": "UUID"}]),
    ])
    add_ops(oauth_uc, [
        ("execute", "Promise<AuthResponseDto>", [{"name": "dto", "type": "OAuthLoginDto"}]),
    ])
    add_ops(grade_uc, [
        ("execute", "Promise<GradedDto>", [{"name": "cmd", "type": "GradeAttemptCommand"}]),
    ])
    add_ops(list_quizzes_uc, [
        ("execute", "Promise<QuizDto[]>", [{"name": "filter", "type": "QuizFilter"}]),
    ])

    # Adapters
    add_ops(user_repo, [
        ("findById", "Promise<User>", [{"name": "id", "type": "UUID"}]),
        ("findByEmail", "Promise<User>", [{"name": "email", "type": "Email"}]),
        ("save", "Promise<User>", [{"name": "u", "type": "User"}]),
    ])
    add_ops(auth_repo, [
        ("create", "Promise<AuthSession>", [{"name": "s", "type": "AuthSession"}]),
        ("findByRefreshHash", "Promise<AuthSession>", [{"name": "h", "type": "string"}]),
        ("revoke", "Promise<void>", [{"name": "id", "type": "UUID"}]),
    ])
    add_ops(jwt_svc, [
        ("sign", "string", [{"name": "p", "type": "JwtPayload"}]),
        ("verify", "JwtPayload", [{"name": "t", "type": "string"}]),
        ("generatePair", "TokenPair", [{"name": "userId", "type": "UUID"}]),
    ])
    add_ops(google_v, [
        ("verifyIdToken", "Promise<VerifiedOAuthProfile>", [{"name": "t", "type": "string"}]),
        ("supports", "boolean", [{"name": "p", "type": "string"}]),
    ])
    add_ops(ms_v, [
        ("verifyIdToken", "Promise<VerifiedOAuthProfile>", [{"name": "t", "type": "string"}]),
        ("supports", "boolean", [{"name": "p", "type": "string"}]),
    ])
    add_ops(registry, [
        ("getVerifier", "IOAuthVerifier", [{"name": "provider", "type": "string"}]),
        ("register", "void", [{"name": "v", "type": "IOAuthVerifier"}]),
    ])
    add_ops(fastapi_client, [
        ("gradeOpenAnswer", "Promise<GradeResult>", [{"name": "text", "type": "string"}]),
        ("generateQuiz", "Promise<Quiz>", [{"name": "topic", "type": "string"}]),
        ("withCircuitBreaker", "Promise<T>", [{"name": "fn", "type": "Function"}]),
    ])
    add_ops(redis_cache, [
        ("get", "Promise<T>", [{"name": "key", "type": "string"}]),
        ("set", "Promise<void>", [{"name": "key", "type": "string"}, {"name": "val", "type": "T"}, {"name": "ttl", "type": "number"}]),
        ("invalidate", "Promise<void>", [{"name": "pattern", "type": "string"}]),
    ])
    add_ops(bull_publisher, [
        ("publish", "Promise<void>", [{"name": "event", "type": "DomainEvent"}]),
        ("flushOutbox", "Promise<void>", []),
    ])
    add_ops(ws_gateway, [
        ("emit", "void", [{"name": "userId", "type": "UUID"}, {"name": "event", "type": "string"}, {"name": "payload", "type": "any"}]),
        ("handleConnection", "void", [{"name": "client", "type": "Socket"}]),
    ])

    # Presentation
    add_ops(auth_ctrl, [
        ("login", "Promise<AuthResponseDto>", [{"name": "dto", "type": "LoginDto"}]),
        ("register", "Promise<AuthResponseDto>", [{"name": "dto", "type": "RegisterDto"}]),
        ("refresh", "Promise<TokenPair>", [{"name": "dto", "type": "RefreshDto"}]),
        ("logout", "Promise<void>", []),
        ("oauthLogin", "Promise<AuthResponseDto>", [{"name": "dto", "type": "OAuthLoginDto"}]),
    ])
    add_ops(quiz_ctrl, [
        ("list", "Promise<QuizDto[]>", [{"name": "q", "type": "QuizFilter"}]),
        ("startSession", "Promise<SessionDto>", [{"name": "quizId", "type": "UUID"}]),
        ("answer", "Promise<void>", [{"name": "dto", "type": "AnswerDto"}]),
        ("grade", "Promise<GradedDto>", [{"name": "sessionId", "type": "UUID"}]),
    ])
    add_ops(jwt_guard, [
        ("canActivate", "boolean", [{"name": "ctx", "type": "ExecutionContext"}]),
    ])
    add_ops(role_guard, [
        ("canActivate", "boolean", [{"name": "ctx", "type": "ExecutionContext"}]),
    ])

    all_classes = [
        # Domain
        user_cls, email_vo, password_vo, session_cls, token_pair,
        quiz_cls, quiz_session_cls, score_vo, domain_event,
        # Ports
        iuser_repo, iauth_repo, itoken_svc, ioauth, iai_port, inotif_port,
        # Use Cases
        login_uc, register_uc, refresh_uc, logout_uc, oauth_uc, grade_uc, list_quizzes_uc,
        # Adapters
        user_repo, auth_repo, jwt_svc, google_v, ms_v, registry,
        fastapi_client, redis_cache, bull_publisher, ws_gateway,
        # Presentation
        auth_ctrl, quiz_ctrl, jwt_guard, role_guard,
    ]
    for c in all_classes:
        model["ownedElements"].append(c)

    realizations = []
    dependencies = []
    associations = []

    # Realizations Adapter → Port
    for adapter, port in [
        (user_repo, iuser_repo),
        (auth_repo, iauth_repo),
        (jwt_svc, itoken_svc),
        (google_v, ioauth),
        (ms_v, ioauth),
        (fastapi_client, iai_port),
        (bull_publisher, inotif_port),
        (ws_gateway, inotif_port),
    ]:
        r = make_realization(mid, adapter, port)
        model["ownedElements"].append(r)
        realizations.append((r, adapter, port))

    # Dependencies UseCase → Port
    for uc, ports in [
        (login_uc, [iuser_repo, iauth_repo, itoken_svc]),
        (oauth_uc, [iuser_repo, iauth_repo, itoken_svc, ioauth]),
        (register_uc, [iuser_repo, itoken_svc, inotif_port]),
        (refresh_uc, [iauth_repo, itoken_svc]),
        (grade_uc, [iai_port, inotif_port]),
        (list_quizzes_uc, [iuser_repo]),
    ]:
        for p in ports:
            d = make_dependency(mid, uc, p, stereotype="uses")
            model["ownedElements"].append(d)
            dependencies.append((d, uc, p))

    d = make_dependency(mid, redis_cache, iuser_repo, stereotype="decorates")
    model["ownedElements"].append(d); dependencies.append((d, redis_cache, iuser_repo))

    for verifier in [google_v, ms_v]:
        d = make_dependency(mid, registry, verifier, stereotype="creates")
        model["ownedElements"].append(d); dependencies.append((d, registry, verifier))

    for uc in [login_uc, register_uc, refresh_uc, logout_uc, oauth_uc]:
        d = make_dependency(mid, auth_ctrl, uc)
        model["ownedElements"].append(d); dependencies.append((d, auth_ctrl, uc))
    for uc in [grade_uc, list_quizzes_uc]:
        d = make_dependency(mid, quiz_ctrl, uc)
        model["ownedElements"].append(d); dependencies.append((d, quiz_ctrl, uc))

    for guard, ctrl in [(jwt_guard, auth_ctrl), (role_guard, quiz_ctrl)]:
        d = make_dependency(mid, guard, ctrl, stereotype="intercepts")
        model["ownedElements"].append(d); dependencies.append((d, guard, ctrl))

    # Composiciones de dominio
    for src, tgt, name, mf, mt in [
        (user_cls, email_vo, "has", "1", "1"),
        (user_cls, password_vo, "has", "1", "1"),
        (user_cls, session_cls, "owns", "1", "*"),
        (quiz_session_cls, score_vo, "produces", "1", "1"),
        (quiz_cls, quiz_session_cls, "played_in", "1", "*"),
    ]:
        a = make_association(mid, src, tgt, name=name, mult_from=mf, mult_to=mt)
        model["ownedElements"].append(a)
        associations.append((a, src, tgt))

    diag, did = make_class_diagram(mid, "Diagrama de Clases UML (Hexagonal)")
    model["ownedElements"].append(diag)

    layout = {
        # Dominio (verde) — filas 0/1
        user_cls["_id"]: (50, 50),
        email_vo["_id"]: (340, 50),
        password_vo["_id"]: (630, 50),
        session_cls["_id"]: (920, 50),
        token_pair["_id"]: (1210, 50),
        quiz_cls["_id"]: (50, 360),
        quiz_session_cls["_id"]: (340, 360),
        score_vo["_id"]: (630, 360),
        domain_event["_id"]: (920, 360),
        # Puertos — fila 2
        iuser_repo["_id"]: (50, 670),
        iauth_repo["_id"]: (290, 670),
        itoken_svc["_id"]: (530, 670),
        ioauth["_id"]: (770, 670),
        iai_port["_id"]: (1010, 670),
        inotif_port["_id"]: (1250, 670),
        # Use Cases (naranja) — fila 3
        login_uc["_id"]: (50, 1000),
        register_uc["_id"]: (290, 1000),
        refresh_uc["_id"]: (530, 1000),
        logout_uc["_id"]: (770, 1000),
        oauth_uc["_id"]: (1010, 1000),
        grade_uc["_id"]: (1250, 1000),
        list_quizzes_uc["_id"]: (1490, 1000),
        # Adapters (azul) — fila 4
        user_repo["_id"]: (50, 1320),
        auth_repo["_id"]: (290, 1320),
        jwt_svc["_id"]: (530, 1320),
        google_v["_id"]: (770, 1320),
        ms_v["_id"]: (1010, 1320),
        registry["_id"]: (1250, 1320),
        fastapi_client["_id"]: (1490, 1320),
        redis_cache["_id"]: (50, 1640),
        bull_publisher["_id"]: (290, 1640),
        ws_gateway["_id"]: (530, 1640),
        # Presentation (rosa) — fila 5
        auth_ctrl["_id"]: (770, 1640),
        quiz_ctrl["_id"]: (1010, 1640),
        jwt_guard["_id"]: (1250, 1640),
        role_guard["_id"]: (1490, 1640),
    }
    cls_view_by_id = {}
    for c in all_classes:
        x, y = layout.get(c["_id"], (0, 0))
        cv = make_class_view(did, c, x, y, w=220, h=240)
        diag["ownedViews"].append(cv)
        cls_view_by_id[c["_id"]] = cv

    # Edge views — TODAS las relaciones visibles
    for assoc, src, tgt in associations:
        diag["ownedViews"].append(make_assoc_view(did, assoc, cls_view_by_id[src["_id"]], cls_view_by_id[tgt["_id"]]))
    for real, src, tgt in realizations:
        diag["ownedViews"].append(make_realization_view(did, real, cls_view_by_id[src["_id"]], cls_view_by_id[tgt["_id"]]))
    for dep, src, tgt in dependencies:
        diag["ownedViews"].append(make_dep_view(did, dep, cls_view_by_id[src["_id"]], cls_view_by_id[tgt["_id"]]))

    # Notas de leyenda y patrones
    note_legend = make_note(mid,
        "LEYENDA DE CAPAS — Arquitectura Hexagonal:\n"
        "- Dominio (verde claro): User, Quiz, QuizSession, Email, Password, Score, DomainEvent\n"
        "- Aplicación (naranja claro): UseCases / Commands / Queries (CQRS)\n"
        "- Infraestructura (azul claro): Adapters TypeORM, JWT, OAuth, FastAPI, Redis, Bull, WS\n"
        "- Presentación (rosa claro): Controllers, Guards, Interceptors\n\n"
        "PATRONES APLICADOS — leídos en stereotypes («Patrón»):\n"
        "Arquitectónicos: Hexagonal, Clean Architecture, DDD, CQRS-lite, EDA, BFF, ACL\n"
        "GoF Creacionales: Factory Method (Registry), Builder (prompts/queries), Singleton\n"
        "GoF Estructurales: Adapter, Facade, Proxy, Decorator, Composite\n"
        "GoF Comportamiento: Strategy, Observer, Chain of Responsibility,\n"
        "Template Method, Command, Mediator, State\n"
        "DDD Táctico: Aggregate Root, Value Object, Entity, Domain Event,\n"
        "Repository, Specification, Unit of Work\n"
        "Resiliencia: Circuit Breaker, Retry, Saga, Outbox, Idempotency Key"
    )
    model["ownedElements"].append(note_legend)
    diag["ownedViews"].append(make_note_view(did, note_legend, 50, 1980, w=1660, h=260))

    save_mdj(project, "04_Clases_UML.mdj")


# ===================== 5. Casos de Uso =====================
def build_use_cases():
    project, model = make_project("ProyDemo - Casos de Uso")
    mid = model["_id"]

    # Actores
    student = make_actor(mid, "Estudiante (USER)")
    teacher = make_actor(mid, "Docente (TEACHER)")
    admin = make_actor(mid, "Administrador (ADMIN)")
    oauth_sys = make_actor(mid, "Sistema OAuth (Google/MS)")
    ai_sys = make_actor(mid, "Servicio IA (FastAPI)")

    # Casos de uso
    use_cases = {}
    uc_list = [
        ("UC_REG", "Registrarse"),
        ("UC_LOGIN", "Iniciar sesión"),
        ("UC_OAUTH", "Login OAuth Google/MS"),
        ("UC_REFRESH", "Refrescar token"),
        ("UC_LOGOUT", "Cerrar sesión"),
        ("UC_VERIFY", "Verificar email"),
        ("UC_LIST", "Listar quizzes"),
        ("UC_START", "Iniciar sesión de quiz"),
        ("UC_ANSWER", "Responder pregunta"),
        ("UC_COMPLETE", "Completar quiz"),
        ("UC_HISTORY", "Ver historial"),
        ("UC_CREATE_Q", "Crear quiz"),
        ("UC_EDIT_Q", "Editar quiz"),
        ("UC_PUBLISH", "Publicar/despublicar"),
        ("UC_AI_GEN", "Generar quiz con IA"),
        ("UC_AI_GRADE", "Calificar respuesta abierta"),
        ("UC_LEAD", "Ver leaderboard"),
        ("UC_ACH", "Ver logros"),
        ("UC_PROGRESS", "Ver progreso"),
        ("UC_NOTIF", "Recibir notificaciones"),
        ("UC_ADM_USERS", "Gestionar usuarios"),
        ("UC_ANALYTICS", "Ver analytics"),
        ("UC_AUDIT", "Auditar logs"),
    ]
    for key, name in uc_list:
        uc = make_usecase(mid, name)
        use_cases[key] = uc
        model["ownedElements"].append(uc)

    for a in [student, teacher, admin, oauth_sys, ai_sys]:
        model["ownedElements"].append(a)

    actor_assocs = []  # (assoc, actor, uc_key)

    def assoc_actor(actor, key):
        a = make_association(mid, actor, use_cases[key], mult_from="", mult_to="")
        model["ownedElements"].append(a)
        actor_assocs.append((a, actor, key))

    student_ucs = ["UC_REG", "UC_LOGIN", "UC_OAUTH", "UC_REFRESH", "UC_LOGOUT", "UC_VERIFY",
                   "UC_LIST", "UC_START", "UC_ANSWER", "UC_COMPLETE", "UC_HISTORY",
                   "UC_LEAD", "UC_ACH", "UC_PROGRESS", "UC_NOTIF"]
    for k in student_ucs:
        assoc_actor(student, k)

    for k in ["UC_CREATE_Q", "UC_EDIT_Q", "UC_PUBLISH", "UC_AI_GEN"]:
        assoc_actor(teacher, k)

    for k in ["UC_ADM_USERS", "UC_ANALYTICS", "UC_AUDIT"]:
        assoc_actor(admin, k)

    assoc_actor(oauth_sys, "UC_OAUTH")
    assoc_actor(ai_sys, "UC_AI_GEN")
    assoc_actor(ai_sys, "UC_AI_GRADE")

    include_pairs = [
        ("UC_LOGIN", "UC_REFRESH"),
        ("UC_OAUTH", "UC_VERIFY"),
        ("UC_COMPLETE", "UC_AI_GRADE"),
        ("UC_COMPLETE", "UC_ACH"),
        ("UC_START", "UC_LIST"),
        ("UC_CREATE_Q", "UC_AI_GEN"),
    ]
    includes_objs = []
    for src, tgt in include_pairs:
        i = make_include(mid, use_cases[src], use_cases[tgt])
        model["ownedElements"].append(i)
        includes_objs.append((i, src, tgt))

    extend_pairs = [
        ("UC_NOTIF", "UC_COMPLETE"),
        ("UC_ACH", "UC_COMPLETE"),
        ("UC_AUDIT", "UC_LOGIN"),
        ("UC_AI_GRADE", "UC_ANSWER"),
    ]
    extends_objs = []
    for src, tgt in extend_pairs:
        e = make_extend(mid, use_cases[src], use_cases[tgt])
        model["ownedElements"].append(e)
        extends_objs.append((e, src, tgt))

    # Diagrama
    diag, did = make_usecase_diagram(mid, "Use Case Diagram")
    model["ownedElements"].append(diag)

    actor_positions = [
        (student, 50, 100),
        (teacher, 50, 350),
        (admin, 50, 600),
        (oauth_sys, 1200, 100),
        (ai_sys, 1200, 400),
    ]
    actor_views = {}
    for el, x, y in actor_positions:
        av = make_actor_view(did, el, x, y)
        diag["ownedViews"].append(av)
        actor_views[el["_id"]] = av

    uc_views = {}
    for i, (key, name) in enumerate(uc_list):
        col = i % 4
        row = i // 4
        x = 200 + col * 220
        y = 80 + row * 130
        uv = make_usecase_view(did, use_cases[key], x, y)
        diag["ownedViews"].append(uv)
        uc_views[key] = uv

    for assoc, actor, key in actor_assocs:
        diag["ownedViews"].append(make_assoc_view(did, assoc, actor_views[actor["_id"]], uc_views[key]))
    for inc, s, t in includes_objs:
        diag["ownedViews"].append(make_include_view(did, inc, uc_views[s], uc_views[t]))
    for ext, s, t in extends_objs:
        diag["ownedViews"].append(make_extend_view(did, ext, uc_views[s], uc_views[t]))

    note = make_note(mid,
        "Notación UML — Casos de Uso:\n"
        "- «include»: comportamiento OBLIGATORIO compartido (línea punteada con flecha)\n"
        "- «extend»: comportamiento OPCIONAL (línea punteada inversa)\n\n"
        "Patrones invocados desde casos de uso:\n"
        "- Strategy: UC_OAUTH (Google/Microsoft intercambiables)\n"
        "- Saga: UC_COMPLETE (orquesta IA + Score + Logros + Notificación)\n"
        "- Observer: UC_NOTIF (suscriptor de eventos de dominio)\n"
        "- Domain Event: UC_ACH (disparado por IntentoCompletado)\n"
        "- CQRS: UC_LIST / UC_LEAD (queries) vs UC_CREATE_Q / UC_PUBLISH (commands)\n"
        "- Chain of Responsibility: JwtAuthGuard + RolesGuard previo a cada UC"
    )
    model["ownedElements"].append(note)
    diag["ownedViews"].append(make_note_view(did, note, 50, 800, w=950, h=180))

    save_mdj(project, "05_Casos_de_Uso.mdj")


# ===================== 7. Componentes / Microservicios =====================
def build_components():
    project, model = make_project("ProyDemo - Componentes / Microservicios")
    mid = model["_id"]

    components = []
    component_specs = [
        ("Next.js App Router", "Frontend", ["BFF Consumer", "Container/Presentational", "Provider"]),
        ("Auth.js v5", "Frontend", ["Strategy", "Adapter"]),
        ("proxy.ts (middleware)", "Frontend", ["Proxy", "Chain of Responsibility"]),
        ("NestJS AuthModule", "Backend", ["Facade", "BFF", "CQRS-lite"]),
        ("NestJS UsersModule", "Backend", ["Facade", "Repository"]),
        ("NestJS QuizModule", "Backend", ["Facade", "Saga Orchestrator"]),
        ("NestJS ScoreModule", "Backend", ["Repository", "Specification"]),
        ("NestJS NotificationsModule", "Backend", ["Observer", "Pub-Sub"]),
        ("NestJS AIClientModule", "Backend", ["Adapter", "Anti-Corruption Layer", "Circuit Breaker", "Retry"]),
        ("JwtAuthGuard (global)", "Backend", ["Decorator", "Chain of Responsibility"]),
        ("WebSocket Gateway", "Backend", ["Observer", "Publisher-Subscriber"]),
        ("FastAPI AI Service", "Microservice", ["RAG", "Microservice", "API Gateway"]),
        ("LangChain Orchestrator", "Microservice", ["Chain of Responsibility", "Template Method"]),
        ("FAISS Vector Store", "Microservice", ["Repository (vectorial)"]),
        ("Ollama Llama 3", "Microservice", ["Adapter (LLM)"]),
        ("Celery Workers", "Microservice", ["Worker", "Retry with Backoff"]),
        ("PostgreSQL", "Database", ["Repository target", "Unit of Work target"]),
        ("Redis", "Cache", ["Proxy", "Cache-Aside"]),
        ("Bull Queue", "Queue", ["Publisher-Subscriber", "Outbox", "Retry"]),
        ("Google Identity", "External", ["OAuth 2.0 Provider"]),
        ("Microsoft Entra ID", "External", ["OAuth 2.0 Provider"]),
        ("SMTP / MailHog", "External", ["Adapter (mail)"]),
    ]
    for name, stereo, patterns in component_specs:
        c = make_component(mid, name, stereotype=stereo, patterns=patterns)
        components.append(c)
        model["ownedElements"].append(c)

    deps = [
        ("Next.js App Router", "NestJS AuthModule"),
        ("Next.js App Router", "NestJS QuizModule"),
        ("Next.js App Router", "WebSocket Gateway"),
        ("Auth.js v5", "Google Identity"),
        ("Auth.js v5", "Microsoft Entra ID"),
        ("Auth.js v5", "NestJS AuthModule"),
        ("NestJS AuthModule", "PostgreSQL"),
        ("NestJS UsersModule", "PostgreSQL"),
        ("NestJS QuizModule", "PostgreSQL"),
        ("NestJS QuizModule", "NestJS AIClientModule"),
        ("NestJS AIClientModule", "FastAPI AI Service"),
        ("FastAPI AI Service", "LangChain Orchestrator"),
        ("LangChain Orchestrator", "FAISS Vector Store"),
        ("LangChain Orchestrator", "Ollama Llama 3"),
        ("FastAPI AI Service", "Celery Workers"),
        ("NestJS NotificationsModule", "Redis"),
        ("NestJS NotificationsModule", "WebSocket Gateway"),
        ("NestJS AuthModule", "Bull Queue"),
        ("Bull Queue", "SMTP / MailHog"),
        ("NestJS ScoreModule", "Redis"),
        ("NestJS ScoreModule", "PostgreSQL"),
        ("JwtAuthGuard (global)", "NestJS AuthModule"),
    ]
    by_name = {c["name"]: c for c in components}
    dep_objs = []
    for s, t in deps:
        d = make_dependency(mid, by_name[s], by_name[t])
        model["ownedElements"].append(d)
        dep_objs.append((d, s, t))

    diag, did = make_component_diagram(mid, "Arquitectura C4 Container / Componentes")
    model["ownedElements"].append(diag)

    layout = [
        # Frontend tier
        ("Next.js App Router", 50, 50),
        ("Auth.js v5", 280, 50),
        ("proxy.ts (middleware)", 510, 50),
        # Backend NestJS tier
        ("NestJS AuthModule", 50, 220),
        ("NestJS UsersModule", 280, 220),
        ("NestJS QuizModule", 510, 220),
        ("NestJS ScoreModule", 740, 220),
        ("NestJS NotificationsModule", 50, 360),
        ("NestJS AIClientModule", 280, 360),
        ("JwtAuthGuard (global)", 510, 360),
        ("WebSocket Gateway", 740, 360),
        # Microservicio IA tier
        ("FastAPI AI Service", 50, 520),
        ("LangChain Orchestrator", 280, 520),
        ("FAISS Vector Store", 510, 520),
        ("Ollama Llama 3", 740, 520),
        ("Celery Workers", 970, 520),
        # Data / infra tier
        ("PostgreSQL", 50, 700),
        ("Redis", 280, 700),
        ("Bull Queue", 510, 700),
        # External
        ("Google Identity", 970, 50),
        ("Microsoft Entra ID", 970, 130),
        ("SMTP / MailHog", 970, 700),
    ]
    comp_views = {}
    for name, x, y in layout:
        cv = make_component_view(did, by_name[name], x, y, w=200, h=110)
        diag["ownedViews"].append(cv)
        comp_views[name] = cv

    # Edge views — dependencias visibles
    for dep, s, t in dep_objs:
        if s in comp_views and t in comp_views:
            diag["ownedViews"].append(make_dep_view(did, dep, comp_views[s], comp_views[t]))

    # Nota C4 + patrones a nivel container
    note = make_note(mid,
        "Arquitectura C4 — Container view + patrones por contenedor:\n\n"
        "FRONTEND (Next.js):\n"
        "  - Container/Presentational, Provider, BFF Consumer\n"
        "  - Auth.js v5 = Strategy + Adapter para OAuth\n\n"
        "BACKEND NestJS:\n"
        "  - Patrón global: Backend For Frontend (BFF)\n"
        "  - Hexagonal: módulos = bounded contexts DDD\n"
        "  - CQRS-lite en use cases\n"
        "  - AIClientModule = Adapter + ACL + Circuit Breaker + Retry → FastAPI\n"
        "  - WebSocketGateway = Observer + Pub-Sub\n"
        "  - JwtAuthGuard = Decorator + Chain of Responsibility\n\n"
        "MICROSERVICIO IA (FastAPI):\n"
        "  - Patrón RAG = FAISS retrieval + Ollama generation\n"
        "  - LangChain = Chain of Responsibility + Template Method\n"
        "  - Celery = Worker + Retry with Backoff\n\n"
        "INFRA:\n"
        "  - Redis = Proxy / Cache-Aside\n"
        "  - Bull = Publisher-Subscriber + Outbox + Retry\n"
        "  - PostgreSQL = Repository target + Unit of Work"
    )
    model["ownedElements"].append(note)
    diag["ownedViews"].append(make_note_view(did, note, 50, 850, w=1150, h=380))

    save_mdj(project, "07_Arquitectura_Microservicios.mdj")
    save_mdj(project, "09_Componentes.mdj")


# ===================== 8. Diagrama de Estados — Intento =====================
def build_states_intento():
    """Máquina de estados del agregado Intento (QuizSession).
       Estados: EN_PROGRESO, COMPLETADO, ABANDONADO.
       Aplica State Pattern."""
    project, model = make_project("ProyDemo - Estados del Intento")
    mid = model["_id"]

    states = ["EN_PROGRESO", "COMPLETADO", "ABANDONADO"]
    docs = {
        "EN_PROGRESO": "Estado inicial. Estudiante responde preguntas. Invariante: completed_at IS NULL.",
        "COMPLETADO": "Estado final. score calculado, IntentoCompletado publicado. Inmutable.",
        "ABANDONADO": "Estado final por timeout o cancelación. Sin score. Permite reintento.",
    }
    cls_by_name = {}
    for s in states:
        c = make_class(mid, s, stereotype="State",
            patterns=["State Pattern"],
            documentation=docs[s])
        cls_by_name[s] = c
        model["ownedElements"].append(c)

    trans = [
        ("EN_PROGRESO", "COMPLETADO", "submitFinalAnswer [allQuestionsAnswered] / calcScore + publishIntentoCompletado"),
        ("EN_PROGRESO", "ABANDONADO", "timeout [now > startedAt + maxDuration] / clearTempState"),
        ("EN_PROGRESO", "ABANDONADO", "cancel() [usuario abandona] / clearTempState"),
    ]
    trans_objs = []
    for src, tgt, label in trans:
        a = make_association(mid, cls_by_name[src], cls_by_name[tgt], name=label, mult_from="", mult_to="")
        model["ownedElements"].append(a)
        trans_objs.append((a, src, tgt))

    diag, did = make_class_diagram(mid, "Estados — Intento (QuizSession)")
    model["ownedElements"].append(diag)

    positions = {
        "EN_PROGRESO": (300, 100),
        "COMPLETADO": (50, 350),
        "ABANDONADO": (550, 350),
    }
    state_views = {}
    for s in states:
        x, y = positions[s]
        v = make_class_view(did, cls_by_name[s], x, y, w=240, h=140)
        diag["ownedViews"].append(v)
        state_views[s] = v

    for a, src, tgt in trans_objs:
        diag["ownedViews"].append(make_assoc_view(did, a, state_views[src], state_views[tgt]))

    note = make_note(mid,
        "Diagrama de Estados — Intento (QuizSession)\n"
        "Patrón: «State Pattern»\n\n"
        "Estados: EN_PROGRESO (inicial), COMPLETADO, ABANDONADO (finales).\n\n"
        "Transiciones (formato evento[guarda]/acción):\n"
        "  EN_PROGRESO → COMPLETADO : submitFinalAnswer[allAnswered] / score + event\n"
        "  EN_PROGRESO → ABANDONADO : timeout[now>deadline] / cleanup\n"
        "  EN_PROGRESO → ABANDONADO : cancel() / cleanup\n\n"
        "Invariantes del agregado Intento:\n"
        "  - Sólo se puede modificar 'answers' en EN_PROGRESO\n"
        "  - COMPLETADO es inmutable (no se permite re-grading sin nuevo intento)\n"
        "  - Score se calcula al transicionar a COMPLETADO (no antes)\n"
        "  - Eventos de dominio: IntentoCompletado, LogroDesbloqueado (consecuente)"
    )
    model["ownedElements"].append(note)
    diag["ownedViews"].append(make_note_view(did, note, 50, 550, w=850, h=240))

    save_mdj(project, "08_Estados_Intento.mdj")


# ===================== 8b. Diagrama de Estados — Sesión de Autenticación =====================
def build_states_sesion():
    """Máquina de estados de Sesión de Autenticación.
       Estados: ACTIVA, REFRESCADA, REVOCADA, EXPIRADA."""
    project, model = make_project("ProyDemo - Estados de Sesión de Autenticación")
    mid = model["_id"]

    states = ["ACTIVA", "REFRESCADA", "REVOCADA", "EXPIRADA"]
    docs = {
        "ACTIVA": "Sesión vigente. accessToken válido. refreshTokenHash en DB.",
        "REFRESCADA": "Tras rotación de refresh. Nueva pareja access+refresh emitida. Estado transitorio que vuelve a ACTIVA con nuevo id.",
        "REVOCADA": "Logout explícito o invalidación por seguridad. is_revoked=true.",
        "EXPIRADA": "expires_at < now. Sin posibilidad de refresh.",
    }
    cls_by_name = {}
    for s in states:
        c = make_class(mid, s, stereotype="State",
            patterns=["State Pattern"],
            documentation=docs[s])
        cls_by_name[s] = c
        model["ownedElements"].append(c)

    trans = [
        ("ACTIVA", "REFRESCADA", "refresh() [refreshToken válido] / rotateTokens"),
        ("REFRESCADA", "ACTIVA", "tokensPersisted / emitTokenPair"),
        ("ACTIVA", "REVOCADA", "logout() / setRevoked=true"),
        ("ACTIVA", "REVOCADA", "securityIncident / setRevoked=true + audit"),
        ("ACTIVA", "EXPIRADA", "tick [now > expires_at] / —"),
        ("REFRESCADA", "REVOCADA", "tokenReuseDetected / setRevoked=true + revoke chain"),
    ]
    trans_objs = []
    for src, tgt, label in trans:
        a = make_association(mid, cls_by_name[src], cls_by_name[tgt], name=label, mult_from="", mult_to="")
        model["ownedElements"].append(a)
        trans_objs.append((a, src, tgt))

    diag, did = make_class_diagram(mid, "Estados — Sesión de Autenticación")
    model["ownedElements"].append(diag)

    positions = {
        "ACTIVA": (50, 200),
        "REFRESCADA": (350, 50),
        "REVOCADA": (650, 200),
        "EXPIRADA": (350, 400),
    }
    state_views = {}
    for s in states:
        x, y = positions[s]
        v = make_class_view(did, cls_by_name[s], x, y, w=240, h=140)
        diag["ownedViews"].append(v)
        state_views[s] = v

    for a, src, tgt in trans_objs:
        diag["ownedViews"].append(make_assoc_view(did, a, state_views[src], state_views[tgt]))

    note = make_note(mid,
        "Diagrama de Estados — Sesión de Autenticación\n"
        "Patrón: «State Pattern»\n\n"
        "Estados: ACTIVA, REFRESCADA, REVOCADA, EXPIRADA.\n\n"
        "Transiciones (evento[guarda]/acción):\n"
        "  ACTIVA → REFRESCADA : refresh()[token válido] / rotateTokens\n"
        "  REFRESCADA → ACTIVA : tokensPersisted / emitTokenPair\n"
        "  ACTIVA → REVOCADA : logout() / setRevoked=true\n"
        "  ACTIVA → REVOCADA : securityIncident / setRevoked + audit\n"
        "  ACTIVA → EXPIRADA : tick [now > expires_at]\n"
        "  REFRESCADA → REVOCADA : tokenReuseDetected / revoke chain (token rotation reuse)\n\n"
        "Manejo JWT + refresh tokens:\n"
        "  - accessToken corto (15 min) en httpOnly cookie\n"
        "  - refreshToken largo (7 días) rotado en cada uso\n"
        "  - Detección de reuse → revocar cadena completa (defensa)\n"
        "  - Indexación expires_at para limpieza por cron job"
    )
    model["ownedElements"].append(note)
    diag["ownedViews"].append(make_note_view(did, note, 50, 580, w=900, h=260))

    save_mdj(project, "08b_Estados_Sesion.mdj")


# ===================== 6. Secuencia (placeholder con notas) =====================
def build_sequence():
    """
    StarUML maneja secuencia con UMLCollaboration + UMLInteraction. Estructura compleja.
    Generamos placeholder con clases representando lifelines + dependencias para indicar mensajes.
    Para diagrama de secuencia real, importar desde PlantUML en StarUML.
    """
    project, model = make_project("ProyDemo - Secuencia OAuth Login (lifelines)")
    mid = model["_id"]

    lifelines = []
    for name in [
        "User",
        "Next.js LoginPage",
        "Server Action signInWithGoogle",
        "Auth.js v5 catch-all",
        "Google / Microsoft",
        "Bridge /api/auth/oauth/bridge",
        "NestJS AuthController",
        "OAuthLoginUseCase",
        "OAuthVerifier",
        "Postgres",
    ]:
        c = make_class(mid, name, stereotype="Lifeline")
        lifelines.append(c)
        model["ownedElements"].append(c)

    messages = [
        (0, 1, "1: click Sign in"),
        (1, 2, "2: invoke signInWithGoogle"),
        (2, 3, "3: signIn(google, redirectTo)"),
        (3, 4, "4: redirect to Google OAuth"),
        (4, 3, "5: callback with code"),
        (3, 4, "6: token exchange code->id_token"),
        (3, 5, "7: redirect to /bridge"),
        (5, 3, "8: auth() read session"),
        (5, 6, "9: POST /auth/oauth {idToken}"),
        (6, 7, "10: execute(dto)"),
        (7, 8, "11: verify(idToken) JWKS"),
        (8, 7, "12: VerifiedOAuthProfile"),
        (7, 9, "13: find/create user"),
        (9, 7, "14: User"),
        (7, 9, "15: insert auth_session"),
        (7, 6, "16: AuthResponseDto"),
        (6, 5, "17: setAuthCookies httpOnly"),
        (5, 1, "18: redirect /dashboard"),
    ]
    msg_objs = []
    for src_idx, tgt_idx, label in messages:
        d = make_dependency(mid, lifelines[src_idx], lifelines[tgt_idx])
        d["name"] = label
        model["ownedElements"].append(d)
        msg_objs.append((d, src_idx, tgt_idx))

    diag, did = make_class_diagram(mid, "Sequence OAuth (lifelines + pattern annotations)")
    model["ownedElements"].append(diag)

    lf_views = []
    for i, c in enumerate(lifelines):
        x = 50 + i * 200
        v = make_class_view(did, c, x, 50, w=180, h=70)
        diag["ownedViews"].append(v)
        lf_views.append(v)

    for dep, si, ti in msg_objs:
        diag["ownedViews"].append(make_dep_view(did, dep, lf_views[si], lf_views[ti]))

    note = make_note(mid,
        "Patrones invocados en flujo Login OAuth:\n"
        "- Strategy: OAuthVerifier (Google/Microsoft) resuelto por OAuthVerifierRegistry\n"
        "- Factory Method: OAuthVerifierRegistry crea verifier por provider\n"
        "- Adapter: GoogleOAuthVerifier / MicrosoftOAuthVerifier sobre JWKS\n"
        "- Chain of Responsibility: middleware Next.js → Auth.js → JwtAuthGuard\n"
        "- Command: OAuthLoginUseCase recibe DTO {idToken, provider}\n"
        "- Repository + Unit of Work: find-or-create User dentro de transacción\n"
        "- Value Object: TokenPair (access + refresh) inmutable\n"
        "- Domain Event: UserLoggedIn publicado tras éxito\n"
        "- Decorator: cookies httpOnly via @SetCookie interceptor"
    )
    model["ownedElements"].append(note)
    diag["ownedViews"].append(make_note_view(did, note, 50, 200, w=1750, h=200))

    save_mdj(project, "06_Secuencia_OAuth.mdj")


# ===================== 6b. Secuencia Resolver Evaluación con IA =====================
def build_sequence_ai():
    """Secuencia: usuario completa evaluación → IA califica → eventos → notificación."""
    project, model = make_project("ProyDemo - Secuencia Resolver Evaluación con IA")
    mid = model["_id"]

    lifelines = []
    for name in [
        "Estudiante",
        "Next.js QuizPage",
        "WebSocket Client",
        "NestJS QuizController",
        "GradeAttemptUseCase",
        "IAIPort",
        "FastApiAIClient (CircuitBreaker)",
        "FastAPI /grade",
        "Celery Worker",
        "FAISS Vector Store",
        "Ollama Llama 3",
        "PostgreSQL",
        "Bull Queue",
        "NotificationsGateway",
    ]:
        c = make_class(mid, name, stereotype="Lifeline")
        lifelines.append(c)
        model["ownedElements"].append(c)

    messages = [
        (0, 1, "1: submitAnswer()"),
        (1, 3, "2: POST /quiz/sessions/:id/answer"),
        (3, 4, "3: execute(GradeAttemptCommand)"),
        (4, 5, "4: gradeOpenAnswer(text)"),
        (5, 6, "5: HTTP POST /grade [Adapter + CircuitBreaker]"),
        (6, 7, "6: forward request"),
        (7, 8, "7: enqueue grading task [Celery]"),
        (8, 9, "8: similarity search [FAISS retrieval]"),
        (9, 8, "9: top-k contexts"),
        (8, 10, "10: prompt augmented [RAG] → generate"),
        (10, 8, "10b: completion"),
        (8, 7, "11: GradeResult {score, feedback}"),
        (7, 6, "12: 200 OK GradeResult"),
        (6, 5, "13: return GradeResult [ACL mapping]"),
        (5, 4, "14: score + feedback IA"),
        (4, 11, "15: UPDATE quiz_sessions (transaction)"),
        (4, 12, "16: publish IntentoCompletado [Outbox]"),
        (12, 13, "17: emit notification:new"),
        (13, 2, "18: WS push feedback IA"),
        (4, 3, "19: GradedDto"),
        (3, 1, "20: 200 OK feedback"),
        (1, 0, "21: render feedback IA"),
    ]
    msg_objs = []
    for src_idx, tgt_idx, label in messages:
        d = make_dependency(mid, lifelines[src_idx], lifelines[tgt_idx])
        d["name"] = label
        model["ownedElements"].append(d)
        msg_objs.append((d, src_idx, tgt_idx))

    diag, did = make_class_diagram(mid, "Sequence Resolver Evaluación con IA")
    model["ownedElements"].append(diag)

    lf_views = []
    for i, c in enumerate(lifelines):
        x = 50 + i * 200
        v = make_class_view(did, c, x, 50, w=190, h=70)
        diag["ownedViews"].append(v)
        lf_views.append(v)

    for dep, si, ti in msg_objs:
        diag["ownedViews"].append(make_dep_view(did, dep, lf_views[si], lf_views[ti]))

    note = make_note(mid,
        "Patrones invocados en flujo Resolver Evaluación con IA:\n"
        "- Saga: GradeAttemptUseCase orquesta IA + persistencia + evento + notificación\n"
        "- Adapter + Anti-Corruption Layer: FastApiAIClient traduce entre dominios NestJS↔FastAPI\n"
        "- Circuit Breaker: FastApiAIClient protege ante caída de FastAPI\n"
        "- Retry with Backoff: Celery reintenta jobs IA\n"
        "- RAG (Retrieval-Augmented Generation): FAISS retrieval + Ollama generation\n"
        "- Outbox: publicación confiable de IntentoCompletado\n"
        "- Observer / Pub-Sub: Bull + NotificationsGateway emiten al cliente\n"
        "- WebSocket Gateway: push en tiempo real al estudiante\n"
        "- Unit of Work: transacción Postgres al actualizar sesión y score\n"
        "- Domain Event: IntentoCompletado dispara LogroDesbloqueado posteriormente"
    )
    model["ownedElements"].append(note)
    diag["ownedViews"].append(make_note_view(did, note, 50, 200, w=2400, h=220))

    save_mdj(project, "06b_Secuencia_IA.mdj")


# ===================== Ejecutar todo =====================
if __name__ == "__main__":
    build_er()
    build_relational()
    build_normalization()
    build_class_diagram()
    build_use_cases()
    build_sequence()
    build_sequence_ai()
    build_components()
    build_states_intento()
    build_states_sesion()
    print("\nTodos los .mdj generados en:", OUT_DIR)
