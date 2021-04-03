a=[]
with open('./out/bundle.js','r') as f:
    a=f.readlines()
a=[x for x in a if x.startswith('    ')]
a=[x[4:] for x in a]
a=[x for x in a if not x.startswith('Object')]
a=[x for x in a if not x.startswith('exports')]
a=[x for x in a if not x=='"use strict";\n']
with open('./out/bundle.js','w') as f:
    f.writelines(a)