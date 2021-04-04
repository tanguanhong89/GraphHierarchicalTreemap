a = []
with open('./out/bundle.js', 'r') as f:
    a = f.readlines()


def foo(l, k):
    if k in l:
        l = l.split(k)
        for i in range(1, len(l)):
            l1 = list(l[i])
            while l1.pop(0) != '.':
                continue
            l[i] = ''.join(l1)
    return ''.join(l)


a = [x for x in a if x.startswith('    ')]
a = [x[4:] for x in a]
a = [x for x in a if not x.startswith('Object')]
a = [x for x in a if not x.startswith('exports')]
a = [x for x in a if not x == '"use strict";\n']
a = [foo(x,'dataStructures_') for x in a]
a = [foo(x,'connectivity_') for x in a]
with open('./out/bundle.js', 'w') as f:
    f.writelines(a)
