let Settings = {
    minPxSize: 10,
    maxDepth: 10,
    pixelCorrection: 8, //+- this value = snapped
    xPortCount: 1, // no point using beyond 1. Path search algo only uses first of each
    yPortCount: 1,
}

let Coloring = {
    Line: undefined,
    Rect: undefined // default defined by createHierarchicalTreemap 
}


let RectPorts = new Map<string, Point[]>()// IO ports of each rect

let DrawnLines = new Map<string, Set<string>>() //individual lines
let DrawnLinks = new Map<string, Set<string>>() //src->dsts

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
    drawn: boolean
    children: Map<string, HierarchicalNode>

    constructor(name: string, value: number) {
        this.name = name
        this.value = value
        this.drawn = false
        this.children = new Map<string, HierarchicalNode>()
    }

    addChild(child: HierarchicalNode) {
        this.children.set(child.name, child)
    }

    addGrandchild(routes: Array<string>, child: HierarchicalNode) {
        this.find(routes).addChild(child)
    }

    find(routes: Array<string>): HierarchicalNode | undefined {
        if (routes.length == 0) return this
        else if (routes.length == 1) {
            return this.children.get(routes[0])
        } else if (routes.length > 1) {
            let immediateChild = routes[0]
            if (this.children.has(immediateChild))
                return this.children.get(immediateChild).find(routes.slice(1))
        }
        return
    }

    updateDrawn(routes: Array<string>) {
        let node = this.find(routes)
        if (node) node.drawn = true
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



let DepthPadding = new Map<number, number>()

let ConnectivityGraphs = new Map<string, Map<string, Set<string>>>() //need to initialize with CalculateConnectivity first!

let RootNode = new HierarchicalNode('root', 0)


export { Settings, RootNode, RectPorts, DepthPadding, ConnectivityGraphs, DrawnLines, DrawnLinks, Coloring }