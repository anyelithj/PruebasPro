"""Generador de los 10 diagramas drawio de ProyDemo — alineados ESTRICTAMENTE al codigo real.

Realidad reflejada (verificada en codigo):
- 11 tablas fisicas PostgreSQL (7 base + 4 nuevas).
- 7 modulos NestJS: auth, users, quiz, score, notifications, feedback, ai.
  * notifications y feedback: SOLO entidad/tabla definida (modulo esqueleto, sin use-cases/controller/WS/SSE).
- AI service FastAPI: routers grading, feedback, assistant (analytics NO montado). Ollama via httpx.
  * LangChain / FAISS / Celery: NO usados en codigo. similarity usa sentence-transformers.
- Sin Mailer/SMTP (verify-email stub; password-reset solo loguea link).
- Sin WebSocket/SSE, sin Bull queues, sin circuit breaker (solo timeout+fallback).
- OpenTrivia: ELIMINADO del codigo.
- Eventos: 1 unico listener real (quiz.completed -> score). Demas eventos emitidos sin consumidor.

Salida: sobrescribe los 10 .drawio en documentos proyecto/diagrams/drawIO/.
"""
from __future__ import annotations

import html
from pathlib import Path

OUT = Path(r"C:/Users/angui/Documents/proyDemo/documentos proyecto/diagrams/drawIO")

# ---- Paleta de colores (leyenda consistente) ----
C_DOM = ("#E8F5E9", "#2E7D32")   # Dominio - verde
C_APP = ("#FFF3E0", "#EF6C00")   # Aplicacion - naranja
C_INF = ("#E3F2FD", "#1565C0")   # Infraestructura - azul
C_PRE = ("#FCE4EC", "#AD1457")   # Presentacion - rosa
C_PAT = ("#FFFDE7", "#F9A825")   # Patrones (notas) - amarillo
C_NEW = ("#F3E5F5", "#8E24AA")   # Tablas/modulos nuevos por RF - magenta
C_EXT = ("#ECEFF1", "#546E7A")   # Sistemas externos - gris
C_TITLE = ("#FFFFFF", "#FFFFFF")

FONT = "fontFamily=Helvetica;"


def esc(s: str) -> str:
    return html.escape(str(s), quote=True).replace("\n", "&#10;")


class Doc:
    """Acumula celdas mxGraph y serializa a un .drawio."""

    def __init__(self, diagram_id: str, name: str, w: int = 2400, h: int = 1600):
        self.id = diagram_id
        self.name = name
        self.w = w
        self.h = h
        self.cells: list[str] = []
        self._n = 0

    def nid(self, prefix="c") -> str:
        self._n += 1
        return f"{prefix}{self._n}"

    def box(self, x, y, w, h, label, fill, stroke, *, fontsize=12, bold=False,
            rounded=True, dashed=False, align="center", valign="middle", cid=None):
        cid = cid or self.nid()
        style = (
            f"rounded={1 if rounded else 0};whiteSpace=wrap;html=1;"
            f"fillColor={fill};strokeColor={stroke};fontSize={fontsize};"
            f"align={align};verticalAlign={valign};{FONT}"
        )
        if bold:
            style += "fontStyle=1;"
        if dashed:
            style += "dashed=1;dashPattern=6 4;"
        self.cells.append(
            f'<mxCell id="{cid}" value="{esc(label)}" style="{style}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'
        )
        return cid

    def note(self, x, y, w, h, label, *, fontsize=11, cid=None):
        cid = cid or self.nid()
        style = (
            f"shape=note;whiteSpace=wrap;html=1;fillColor={C_PAT[0]};strokeColor={C_PAT[1]};"
            f"fontSize={fontsize};align=left;verticalAlign=top;spacingLeft=6;spacingTop=4;{FONT}"
        )
        self.cells.append(
            f'<mxCell id="{cid}" value="{esc(label)}" style="{style}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'
        )
        return cid

    def title(self, label, w=None):
        w = w or self.w - 80
        self.box(40, 16, w, 56, label, "#FFFFFF", "#FFFFFF",
                 fontsize=17, bold=True, rounded=False)

    def table(self, x, y, w, title, rows, fill, stroke, *, row_h=22, title_h=30):
        """Tabla estilo entidad: titulo + filas. rows = list[str]."""
        cid = self.nid("tbl")
        h = title_h + row_h * len(rows)
        cont = (
            f"swimlane;rounded=1;html=1;startSize={title_h};fillColor={fill};"
            f"strokeColor={stroke};fontSize=12;fontStyle=1;align=center;{FONT}"
        )
        self.cells.append(
            f'<mxCell id="{cid}" value="{esc(title)}" style="{cont}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'
        )
        for i, r in enumerate(rows):
            rs = (
                f"text;html=1;align=left;verticalAlign=middle;spacingLeft=8;fontSize=11;"
                f"strokeColor={stroke};fillColor=#FFFFFF;{FONT}"
            )
            self.cells.append(
                f'<mxCell id="{self.nid()}" value="{esc(r)}" style="{rs}" vertex="1" parent="{cid}">'
                f'<mxGeometry x="0" y="{title_h + i*row_h}" width="{w}" height="{row_h}" as="geometry"/></mxCell>'
            )
        return cid, h

    def edge(self, src, dst, label="", *, style_extra="", dashed=False, start="", end="open"):
        cid = self.nid("e")
        style = (
            f"edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;fontSize=10;{FONT}"
            f"endArrow={end};startArrow={start or 'none'};"
        )
        if dashed:
            style += "dashed=1;dashPattern=6 4;"
        style += style_extra
        self.cells.append(
            f'<mxCell id="{cid}" value="{esc(label)}" style="{style}" edge="1" parent="1" '
            f'source="{src}" target="{dst}"><mxGeometry relative="1" as="geometry"/></mxCell>'
        )
        return cid

    def lifeline(self, x, label, fill, stroke, *, y=90, head_h=44, w=150, bottom=1500):
        cid = self.nid("ll")
        style = (
            f"shape=umlActor;html=1;" if False else
            f"rounded=1;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};"
            f"fontSize=11;fontStyle=1;align=center;{FONT}"
        )
        self.box(x, y, w, head_h, label, fill, stroke, fontsize=11, bold=True, cid=cid)
        # linea de vida
        line = self.nid("lf")
        self.cells.append(
            f'<mxCell id="{line}" style="endArrow=none;html=1;strokeColor={stroke};dashed=1;dashPattern=4 4;" '
            f'edge="1" parent="1"><mxGeometry relative="1" as="geometry">'
            f'<mxPoint x="{x + w//2}" y="{y + head_h}" as="sourcePoint"/>'
            f'<mxPoint x="{x + w//2}" y="{bottom}" as="targetPoint"/></mxGeometry></mxCell>'
        )
        return x + w // 2  # devuelve x central para mensajes

    def msg(self, x1, x2, y, label, *, dashed=False, color="#333333"):
        cid = self.nid("m")
        end = "open"
        style = (
            f"html=1;endArrow={end};fontSize=10;{FONT}strokeColor={color};"
            f"{'dashed=1;dashPattern=6 3;' if dashed else ''}"
            f"align={'left' if x2>=x1 else 'right'};verticalAlign=bottom;"
        )
        self.cells.append(
            f'<mxCell id="{cid}" value="{esc(label)}" style="{style}" edge="1" parent="1">'
            f'<mxGeometry relative="1" as="geometry">'
            f'<mxPoint x="{x1}" y="{y}" as="sourcePoint"/>'
            f'<mxPoint x="{x2}" y="{y}" as="targetPoint"/></mxGeometry></mxCell>'
        )

    def state(self, x, y, w, h, label, fill, stroke, *, cid=None):
        cid = cid or self.nid("st")
        style = (
            f"rounded=1;arcSize=40;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};"
            f"fontSize=11;fontStyle=1;{FONT}"
        )
        self.cells.append(
            f'<mxCell id="{cid}" value="{esc(label)}" style="{style}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'
        )
        return cid

    def dot(self, x, y, *, final=False, cid=None):
        cid = cid or self.nid("dot")
        if final:
            style = "ellipse;html=1;fillColor=#000000;strokeColor=#000000;shape=endState;"
            style = "ellipse;html=1;fillColor=#FFFFFF;strokeColor=#000000;"
        else:
            style = "ellipse;html=1;fillColor=#000000;strokeColor=#000000;"
        self.cells.append(
            f'<mxCell id="{cid}" value="" style="{style}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="20" height="20" as="geometry"/></mxCell>'
        )
        return cid

    def legend(self, x, y, items, *, w=300, title="LEYENDA"):
        rows = "\n".join(f"■ {lbl}" for lbl in items)
        self.box(x, y, w, 28 + 16 * len(items),
                 f"{title}\n{rows}", C_PAT[0], C_PAT[1],
                 fontsize=10, align="left", valign="top")

    def save(self):
        body = "\n".join(self.cells)
        xml = (
            f'<mxfile host="app.diagrams.net" agent="claude-code" version="24.7.0" type="device">\n'
            f'  <diagram id="{self.id}" name="{esc(self.name)}">\n'
            f'    <mxGraphModel dx="2400" dy="1600" grid="1" gridSize="10" guides="1" '
            f'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
            f'pageWidth="{self.w}" pageHeight="{self.h}" math="0" shadow="0">\n'
            f'      <root>\n'
            f'        <mxCell id="0"/>\n'
            f'        <mxCell id="1" parent="0"/>\n'
            f'{body}\n'
            f'      </root>\n'
            f'    </mxGraphModel>\n'
            f'  </diagram>\n'
            f'</mxfile>\n'
        )
        return xml


COLOR_LEGEND = [
    "Dominio (verde)", "Aplicacion (naranja)", "Infraestructura (azul)",
    "Presentacion (rosa)", "Patrones / notas (amarillo)",
    "Tablas/modulos nuevos por RF (magenta)", "Sistemas externos (gris)",
]
