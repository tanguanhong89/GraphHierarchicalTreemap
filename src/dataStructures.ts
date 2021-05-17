let GraphHierarchicalTreemap = {
    minPxSize: 10,
    maxDepth: 20,
    pixelCorrection: 8, //+- this value = snapped
    xPortCount: 1, // no point using beyond 1. Path search algo only uses first of each
    yPortCount: 1,

    connectivityGraphs: new Map<string, Map<string, Set<string>>>(),
    rectPorts: new Map<string, Point[]>(),// IO ports of each rect
    drawnLines: new Map<string, Set<string>>(),
    drawnLinks: new Map<string, Map<string, Array<string>>>(),//src -> dsts (each point xy)

    depthPadding: new Map<number, number>(),

    coloring: {
        line: undefined,
        rect: undefined
    }
}

let NodeLookup = new Map<string, string[]>();


export class Point {
    x: number
    y: number

    constructor(x: number, y: number) {
        this.x = x
        this.y = y
    }

    getUniqueKey(): string {
        return this.x + '_' + this.y
    }

    checkSame(p: Point): boolean {
        if (this.x == p.x && this.y == p.y) return true
        return false
    }


}

export class HierarchicalNode {
    name: string
    value: number
    children: Map<string, HierarchicalNode>

    constructor(name: string, value: number) {
        this.name = name
        this.value = value
        this.children = new Map<string, HierarchicalNode>()
    }

    addChild(child: HierarchicalNode) {
        this.children.set(child.name, child)
    }

    addGrandchild(routes: Array<string>, child: HierarchicalNode) {
        this.find(routes).addChild(child)
        NodeLookup[child.name] = routes
    }

    find(routes: Array<string>): HierarchicalNode | undefined {
        if (routes.length == 0) return this
        if (this.name == routes[0]) {
            if (routes.length == 1) return this
            else return this.children.get(routes[1]).find(routes.slice(1))
        }
        return
    }

    createImmediateObject(): any {
        let t = this._createMapObject()
        this.children.forEach(c => t.children.push(c._createMapObject()))
        return t
    }

    _createMapObject(): any {//for d3 rendering
        return {
            n: this.name,
            v: this.value,
            children: []
        }
    }
}


let RootNode = new HierarchicalNode('root', 0)

let LinksWaitingList = new Set();

export { GraphHierarchicalTreemap, RootNode, NodeLookup, LinksWaitingList }