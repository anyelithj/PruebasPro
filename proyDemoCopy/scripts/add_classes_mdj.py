"""Agrega clases existentes en codigo (HashedPassword, Points, TokenType, AIProvider) al .mdj con vistas."""
import json
import itertools

PATH = r'documentos proyecto/diagrams/drawIO/diagrama de clases UML.mdj'
with open(PATH, encoding='utf-8') as f:
    d = json.load(f)

model = d['ownedElements'][0]
diagram = next(c for c in model['ownedElements'] if c.get('_type') == 'UMLClassDiagram')

views = [v for v in diagram.get('ownedViews', []) if v.get('_type') == 'UMLClassView']
max_bottom = max(v.get('top', 0) + v.get('height', 0) for v in views)
min_left = min(v.get('left', 0) for v in views)

counter = itertools.count(1)


def nid():
    return 'CLAUDE-ADD-%04d' % next(counter)


def make_class(name, stereotype, attrs, ops):
    cid = nid()
    cls = {"_type": "UMLClass", "_id": cid, "_parent": {"$ref": model['_id']}, "name": name}
    if stereotype:
        cls['stereotype'] = stereotype
    if attrs:
        cls['attributes'] = [
            {"_type": "UMLAttribute", "_id": nid(), "_parent": {"$ref": cid}, "name": an, "type": at}
            for an, at in attrs]
    if ops:
        cls['operations'] = []
        for on, params, ret, static in ops:
            op = {"_type": "UMLOperation", "_id": nid(), "_parent": {"$ref": cid}, "name": on}
            if static:
                op['isStatic'] = True
            ps = [{"_type": "UMLParameter", "_id": nid(), "_parent": {"$ref": op['_id']},
                   "name": pn, "type": pt} for pn, pt in params]
            if ret:
                ps.append({"_type": "UMLParameter", "_id": nid(), "_parent": {"$ref": op['_id']},
                           "type": ret, "direction": "return"})
            if ps:
                op['parameters'] = ps
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
                            font="Arial;13;1", parentStyle=True, text=cls['name'],
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
        if stereotype == 'enumeration':
            txt = a['name']
        else:
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
        params = [p for p in o.get('parameters', []) or [] if p.get('direction') != 'return']
        ret = next((p['type'] for p in o.get('parameters', []) or []
                    if p.get('direction') == 'return'), None)
        txt = '+%s(%s)' % (o['name'], ', '.join(p['name'] for p in params))
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


# Todas existen en codigo:
#   hashed-password.vo.ts · points.vo.ts · token.entity.ts (TokenType) · ai-provider.vo.ts
SPECS = [
    ("HashedPassword", "ValueObject", [("value", "string")],
     [("fromHash", [("hash", "string")], "HashedPassword", True),
      ("equals", [("other", "HashedPassword")], "boolean", False)]),
    ("Points", "ValueObject", [("value", "int")],
     [("create", [("value", "int")], "Points", True),
      ("add", [("other", "Points")], "Points", False),
      ("equals", [("other", "Points")], "boolean", False)]),
    ("TokenType", "enumeration", [("ACCESS", ""), ("REFRESH", "")], []),
    ("AIProvider", "enumeration", [("QWEN", ""), ("MISTRAL", "")], []),
]

existing = {c['name'] for c in model['ownedElements'] if c.get('_type') == 'UMLClass'}
x = min_left
y = max_bottom + 60
W = 210
added = []
for name, st, attrs, ops in SPECS:
    if name in existing:
        continue
    cls = make_class(name, st, attrs, ops)
    model['ownedElements'].append(cls)
    diagram['ownedViews'].append(make_view(cls, x, y, W))
    added.append(name)
    x += W + 40

with open(PATH, 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False, indent='\t')
print('Agregadas:', added, '| fila y =', y)
