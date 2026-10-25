"""Agrega cluster de patrones quiz-IA al .mdj (todo existe en codigo):
IAIQuestionProvider (port) <- BaseOllamaAIProvider (Template Method) <- Qwen/Mistral
AIProviderFactory (Factory + Registry) ..> IAIQuestionProvider
"""
import json
import itertools

PATH = r'documentos proyecto/diagrams/drawIO/diagrama de clases UML.mdj'
with open(PATH, encoding='utf-8') as f:
    d = json.load(f)

model = d['ownedElements'][0]
diagram = next(c for c in model['ownedElements'] if c.get('_type') == 'UMLClassDiagram')
existing = {c['name'] for c in model['ownedElements'] if c.get('_type') == 'UMLClass'}
if 'AIProviderFactory' in existing:
    raise SystemExit('cluster ya agregado')

views = [v for v in diagram.get('ownedViews', []) if v.get('_type') == 'UMLClassView']
max_bottom = max(v.get('top', 0) + v.get('height', 0) for v in views)
min_left = min(v.get('left', 0) for v in views)

counter = itertools.count(1)


def nid():
    return 'CLAUDE-PAT-%04d' % next(counter)


def make_class(name, stereotype, attrs, ops, is_abstract=False):
    cid = nid()
    cls = {"_type": "UMLClass", "_id": cid, "_parent": {"$ref": model['_id']}, "name": name}
    if stereotype:
        cls['stereotype'] = stereotype
    if is_abstract:
        cls['isAbstract'] = True
    if attrs:
        cls['attributes'] = [
            {"_type": "UMLAttribute", "_id": nid(), "_parent": {"$ref": cid}, "name": an, "type": at}
            for an, at in attrs]
    if ops:
        cls['operations'] = []
        for on, ret, flags in ops:
            op = {"_type": "UMLOperation", "_id": nid(), "_parent": {"$ref": cid}, "name": on}
            if 'static' in flags:
                op['isStatic'] = True
            if 'abstract' in flags:
                op['isAbstract'] = True
            if 'protected' in flags:
                op['visibility'] = 'protected'
            if ret:
                op['parameters'] = [{"_type": "UMLParameter", "_id": nid(),
                                     "_parent": {"$ref": op['_id']}, "type": ret,
                                     "direction": "return"}]
            cls['operations'].append(op)
    return cls


LBL = {"font": "Arial;13;0", "parentStyle": True, "height": 13}


def make_view(cls, left, top, width):
    vid = nid()
    name_cmp_id, attr_cmp_id, op_cmp_id, rec_id, tpl_id = nid(), nid(), nid(), nid(), nid()
    mref = {"$ref": cls['_id']}
    stereotype = cls.get('stereotype')
    y = top + 5
    name_labels = [
        dict(_type="LabelView", _id=nid(), _parent={"$ref": name_cmp_id},
             visible=bool(stereotype), text=(u'«%s»' % stereotype if stereotype else ''),
             left=left + 5, top=y, width=width - 10, **LBL),
    ]
    if stereotype:
        y += 15
    name_labels.append(dict(_type="LabelView", _id=nid(), _parent={"$ref": name_cmp_id},
                            font="Arial;13;3" if cls.get('isAbstract') else "Arial;13;1",
                            parentStyle=True, text=cls['name'],
                            left=left + 5, top=y, width=width - 10, height=13))
    name_labels += [
        dict(_type="LabelView", _id=nid(), _parent={"$ref": name_cmp_id}, visible=False,
             text="(from Model)", left=left + 5, top=y, width=width - 10, **LBL),
        dict(_type="LabelView", _id=nid(), _parent={"$ref": name_cmp_id}, visible=False,
             horizontalAlignment=1, left=left + 5, top=y, width=width - 10, **LBL),
    ]
    name_h = 25 + (15 if stereotype else 0)
    name_cmp = dict(_type="UMLNameCompartmentView", _id=name_cmp_id, _parent={"$ref": vid},
                    model=mref, subViews=name_labels, font="Arial;13;0", parentStyle=True,
                    left=left, top=top, width=width, height=name_h,
                    stereotypeLabel={"$ref": name_labels[0]['_id']},
                    nameLabel={"$ref": name_labels[1]['_id']},
                    namespaceLabel={"$ref": name_labels[2]['_id']},
                    propertyLabel={"$ref": name_labels[3]['_id']})
    ay = top + name_h + 5
    attr_views = []
    for a in cls.get('attributes', []) or []:
        txt = '-%s' % a['name'] + (': %s' % a['type'] if a.get('type') else '')
        attr_views.append(dict(_type="UMLAttributeView", _id=nid(), _parent={"$ref": attr_cmp_id},
                               model={"$ref": a['_id']}, text=txt, horizontalAlignment=0,
                               left=left + 5, top=ay, width=width - 10, **LBL))
        ay += 15
    attr_h = max(len(attr_views) * 15 + 8, 10)
    attr_cmp = dict(_type="UMLAttributeCompartmentView", _id=attr_cmp_id, _parent={"$ref": vid},
                    model=mref, subViews=attr_views, font="Arial;13;0", parentStyle=True,
                    left=left, top=top + name_h, width=width, height=attr_h)
    oy = top + name_h + attr_h + 5
    op_views = []
    for o in cls.get('operations', []) or []:
        ret = next((p['type'] for p in o.get('parameters', []) or []
                    if p.get('direction') == 'return'), None)
        vis = '#' if o.get('visibility') == 'protected' else '+'
        txt = '%s%s()' % (vis, o['name'])
        if ret:
            txt += ': %s' % ret
        op_views.append(dict(_type="UMLOperationView", _id=nid(), _parent={"$ref": op_cmp_id},
                             model={"$ref": o['_id']}, text=txt, horizontalAlignment=0,
                             left=left + 5, top=oy, width=width - 10, **LBL))
        oy += 15
    op_h = max(len(op_views) * 15 + 8, 10)
    op_cmp = dict(_type="UMLOperationCompartmentView", _id=op_cmp_id, _parent={"$ref": vid},
                  model=mref, subViews=op_views, font="Arial;13;0", parentStyle=True,
                  left=left, top=top + name_h + attr_h, width=width, height=op_h)
    rec = dict(_type="UMLReceptionCompartmentView", _id=rec_id, _parent={"$ref": vid}, model=mref,
               visible=False, font="Arial;13;0", parentStyle=True,
               left=left, top=top, width=10, height=10)
    tpl = dict(_type="UMLTemplateParameterCompartmentView", _id=tpl_id, _parent={"$ref": vid},
               model=mref, visible=False, font="Arial;13;0", parentStyle=True,
               left=left, top=top, width=10, height=10)
    total_h = name_h + attr_h + op_h
    return dict(_type="UMLClassView", _id=vid, _parent={"$ref": diagram['_id']}, model=mref,
                subViews=[name_cmp, attr_cmp, op_cmp, rec, tpl],
                font="Arial;13;0", parentStyle=False, containerChangeable=True,
                left=left, top=top, width=width, height=total_h,
                nameCompartment={"$ref": name_cmp_id},
                attributeCompartment={"$ref": attr_cmp_id},
                operationCompartment={"$ref": op_cmp_id},
                receptionCompartment={"$ref": rec_id},
                templateParameterCompartment={"$ref": tpl_id})


def edge_labels(parent_id):
    return [dict(_type="EdgeLabelView", _id=nid(), _parent={"$ref": parent_id},
                 visible=False, font="Arial;13;0", parentStyle=True,
                 left=0, top=0, height=13) for _ in range(3)]


def center(view):
    return (view['left'] + view['width'] // 2, view['top'] + view['height'] // 2)


def make_edge(view_type, model_elem, tail_view, head_view, line_style=1):
    eid = nid()
    labels = edge_labels(eid)
    tx, ty = center(tail_view)
    hx, hy = center(head_view)
    return dict(_type=view_type, _id=eid, _parent={"$ref": diagram['_id']},
                model={"$ref": model_elem['_id']}, subViews=labels,
                font="Arial;13;0", parentStyle=False,
                head={"$ref": head_view['_id']}, tail={"$ref": tail_view['_id']},
                lineStyle=line_style, points="%d:%d;%d:%d" % (tx, ty, hx, hy),
                nameLabel={"$ref": labels[0]['_id']},
                stereotypeLabel={"$ref": labels[1]['_id']},
                propertyLabel={"$ref": labels[2]['_id']})


# ===== clases (firmas reales del codigo) =====
iface = make_class("IAIQuestionProvider", "interface",
                   [("id", "AIProvider")],
                   [("generateQuestions", "Promise<AIGeneratedQuestion[]>", [])])
base = make_class("BaseOllamaAIProvider", "Template Method",
                  [("baseUrl", "string"), ("model", "string"), ("TIMEOUT_MS", "int")],
                  [("generateQuestions", "Promise<AIGeneratedQuestion[]>", []),
                   ("callOllama", "Promise<string>", ["protected"]),
                   ("buildPrompt", "string", ["protected"]),
                   ("parseJsonArray", "unknown[]", ["protected"])],
                  is_abstract=True)
qwen = make_class("QwenProvider", None, [("id", "AIProvider"), ("model", "string")], [])
mistral = make_class("MistralProvider", None, [("id", "AIProvider"), ("model", "string")], [])
factory = make_class("AIProviderFactory", "Factory",
                     [("registry", "Map<AIProvider, IAIQuestionProvider>")],
                     [("get", "IAIQuestionProvider", []),
                      ("generateWithFallback", "Promise<...>", [])])

for c in (iface, base, qwen, mistral, factory):
    model['ownedElements'].append(c)

# ===== relaciones de modelo =====
def gen(child, parent):
    g = {"_type": "UMLGeneralization", "_id": nid(), "_parent": {"$ref": child['_id']},
         "source": {"$ref": child['_id']}, "target": {"$ref": parent['_id']}}
    child.setdefault('ownedElements', []).append(g)
    return g

g_base = gen(base, iface)        # realiza el port (DIP)
g_qwen = gen(qwen, base)         # Template Method (LSP)
g_mistral = gen(mistral, base)
dep = {"_type": "UMLDependency", "_id": nid(), "_parent": {"$ref": factory['_id']},
       "name": "crea/selecciona", "source": {"$ref": factory['_id']},
       "target": {"$ref": iface['_id']}}
factory.setdefault('ownedElements', []).append(dep)

# ===== vistas =====
y0 = max_bottom + 60
W = 250
v_iface = make_view(iface, min_left + 300, y0, W)
v_base = make_view(base, min_left + 300, y0 + 180, W)
v_qwen = make_view(qwen, min_left + 60, y0 + 400, 200)
v_mistral = make_view(mistral, min_left + 620, y0 + 400, 200)
v_factory = make_view(factory, min_left + 660, y0, 300)

for v in (v_iface, v_base, v_qwen, v_mistral, v_factory):
    diagram['ownedViews'].append(v)

diagram['ownedViews'].append(make_edge("UMLGeneralizationView", g_base, v_base, v_iface))
diagram['ownedViews'].append(make_edge("UMLGeneralizationView", g_qwen, v_qwen, v_base))
diagram['ownedViews'].append(make_edge("UMLGeneralizationView", g_mistral, v_mistral, v_base))
diagram['ownedViews'].append(make_edge("UMLDependencyView", dep, v_factory, v_iface))

with open(PATH, 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False, indent='\t')
print('Cluster patrones agregado en y =', y0)
