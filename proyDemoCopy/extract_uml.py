import json

with open('Diagramas finales/diagrama de clases UML.mdj', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Build a map of _id -> name
id_to_name = {}
id_to_elem = {}

def index_elements(obj):
    if isinstance(obj, dict):
        if '_id' in obj and 'name' in obj:
            id_to_name[obj['_id']] = obj['name']
            id_to_elem[obj['_id']] = obj
        for v in obj.values():
            index_elements(v)
    elif isinstance(obj, list):
        for item in obj:
            index_elements(item)

index_elements(data)

def resolve_ref(ref):
    if isinstance(ref, dict) and '$ref' in ref:
        rid = ref['$ref']
        return id_to_name.get(rid, rid)
    return str(ref)

def find_elements(obj, target_type):
    results = []
    if isinstance(obj, dict):
        if obj.get('_type') == target_type:
            results.append(obj)
        for v in obj.values():
            results.extend(find_elements(v, target_type))
    elif isinstance(obj, list):
        for item in obj:
            results.extend(find_elements(item, target_type))
    return results

classes = find_elements(data, 'UMLClass')

actual_classes = []
actual_enums = []
actual_interfaces = []

for c in classes:
    stereo = c.get('stereotype', '')
    if stereo == 'enumeration':
        actual_enums.append(c)
    elif stereo == 'interface':
        actual_interfaces.append(c)
    else:
        actual_classes.append(c)

# Also find UMLEnumeration and UMLInterface types
enums_from_type = find_elements(data, 'UMLEnumeration')
for e in enums_from_type:
    if e not in actual_enums:
        actual_enums.append(e)

interfaces_from_type = find_elements(data, 'UMLInterface')
for i in interfaces_from_type:
    if i not in actual_interfaces:
        actual_interfaces.append(i)

def get_attributes(elem):
    attrs = []
    for a in elem.get('attributes', []):
        if a.get('_type') == 'UMLAttribute':
            t = a.get('type', '')
            if isinstance(t, dict):
                t = resolve_ref(t)
            attrs.append((a['name'], str(t), a.get('visibility', 'private')))
    return attrs

def get_operations(elem):
    ops = []
    for op in elem.get('operations', []):
        if op.get('_type') == 'UMLOperation':
            params = []
            ret = 'void'
            for p in op.get('parameters', []):
                if p.get('_type') == 'UMLParameter':
                    pt = p.get('type', '')
                    if isinstance(pt, dict):
                        pt = resolve_ref(pt)
                    if p.get('direction') == 'return':
                        ret = str(pt)
                    else:
                        pn = p.get('name', '')
                        if pn:
                            params.append(f"{pn}: {pt}")
                        else:
                            params.append(f": {pt}")
            # Also check ownedElements for params
            for p in op.get('ownedElements', []):
                if p.get('_type') == 'UMLParameter':
                    pt = p.get('type', '')
                    if isinstance(pt, dict):
                        pt = resolve_ref(pt)
                    if p.get('direction') == 'return':
                        ret = str(pt)
                    else:
                        pn = p.get('name', '')
                        if pn:
                            params.append(f"{pn}: {pt}")
                        else:
                            params.append(f": {pt}")
            static_flag = op.get('isStatic', False)
            vis = op.get('visibility', 'public')
            ops.append((op['name'], params, ret, vis, static_flag))
    return ops

print('=== 1. CLASSES ===')
for c in sorted(actual_classes, key=lambda x: x['name']):
    abstract = c.get('isAbstract', False)
    stereo = c.get('stereotype', '')
    print(f"**{c['name']}** (abstract={abstract}, stereotype='{stereo}')")
    attrs = get_attributes(c)
    for n, t, v in attrs:
        print(f"  - {n}: {t}")
    ops = get_operations(c)
    for oname, params, ret, vis, static in ops:
        static_str = ' {static}' if static else ''
        print(f"  +{oname}({', '.join(params)}): {ret}{static_str}")
    print()

print('=== 2. ENUMS ===')
for e in sorted(actual_enums, key=lambda x: x['name']):
    print(f"**{e['name']}**")
    for a in e.get('attributes', []):
        if a.get('_type') == 'UMLAttribute':
            print(f"  - {a['name']}")
    print()

print('=== 3. INTERFACES ===')
for i in sorted(actual_interfaces, key=lambda x: x['name']):
    print(f"**{i['name']}**")
    for a in i.get('attributes', []):
        if a.get('_type') == 'UMLAttribute':
            t = a.get('type', '')
            if isinstance(t, dict):
                t = resolve_ref(t)
            print(f"  - {a['name']}: {t}")
    ops = get_operations(i)
    for oname, params, ret, vis, static in ops:
        static_str = ' {static}' if static else ''
        print(f"  +{oname}({', '.join(params)}): {ret}{static_str}")
    print()

# Associations
print('=== 4. RELATIONSHIPS ===')
print('--- Associations ---')
associations = find_elements(data, 'UMLAssociation')
for a in associations:
    ends = []
    if 'end1' in a and 'end2' in a:
        for end_key in ['end1', 'end2']:
            end = a[end_key]
            ref = end.get('reference', {})
            ref_name = resolve_ref(ref)
            mult = end.get('multiplicity', '')
            agg = end.get('aggregation', '')
            end_name = end.get('name', '')
            ends.append((ref_name, end_name, mult, agg))
        e1_name, e1_role, e1_mult, e1_agg = ends[0]
        e2_name, e2_role, e2_mult, e2_agg = ends[1]
        agg_type = 'composite' if e1_agg == 'composite' or e2_agg == 'composite' else ('shared' if e1_agg == 'shared' or e2_agg == 'shared' else 'simple')
        print(f"  {e1_name} [{e1_mult}] <--> {e2_name} [{e2_mult}] (aggregation={agg_type})")

print()
print('--- Generalizations ---')
gens = find_elements(data, 'UMLGeneralization')
for g in gens:
    src = resolve_ref(g.get('source', ''))
    tgt = resolve_ref(g.get('target', ''))
    print(f"  {src} -> {tgt}")

print()
print('--- Interface Realizations ---')
reals = find_elements(data, 'UMLInterfaceRealization')
for r in reals:
    sup = resolve_ref(r.get('supplier', ''))
    cli = resolve_ref(r.get('client', ''))
    print(f"  {cli} realizes {sup}")

print()
print('--- Dependencies ---')
deps = find_elements(data, 'UMLDependency')
for d in deps:
    src = resolve_ref(d.get('source', ''))
    tgt = resolve_ref(d.get('target', ''))
    name = d.get('name', 'unnamed')
    print(f"  {src} --{name}--> {tgt}")
