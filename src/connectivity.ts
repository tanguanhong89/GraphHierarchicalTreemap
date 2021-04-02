import { Settings, Point, RectPorts,ConnectivityGraphs, DrawnLines, DepthPadding, Coloring } from './dataStructures'
import * as d3 from 'd3'

class Snappables {
    x: Set<number>
    y: Set<number>
    constructor() {
        this.x = new Set<number>()
        this.y = new Set<number>()
    }
}

export function CalculateConnectivity(parentID: string, padding: number):Map<string, Set<string>> {
    let connectivity=new Map<string, Set<string>>()
    let snappables = new Snappables()

    padding = Math.round(padding / 2)
    let grects = $(".p" + parentID.replace(/\./g, '\\.'));

    function findSnap(v: number, k: string): number { //snap to either existing x's or y's
        let vlist = k == 'x' ? snappables.x : snappables.y
        vlist.forEach(x => {
            if (Math.abs(v - x) <= Settings.pixelCorrection) {
                v = x
            }
        })
        if (k == 'x') snappables.x.add(v)
        else snappables.y.add(v)

        return v
    }

    function addBidirect(ak: string, bk: string) {
        if (!(connectivity.has(ak))) connectivity.set(ak, new Set())
        if (!(connectivity.has(bk))) connectivity.set(bk, new Set())
        connectivity.get(ak)?.add(bk)
        connectivity.get(bk)?.add(ak)
    }

    function interpolate(start: number, end: number, splitCnt: number) {
        let v = []
        let interval = (end - start) / (splitCnt + 1)
        for (let i = 0; i < splitCnt + 1; i++) v.push(Math.round(start + interval * i))
        v.push(end)
        return v
    }

    let parentPorts = RectPorts.get(parentID)
    let parentPortsPadded = Array<Point>()
    if (parentPorts != undefined) {
        for (let i = 0; i < parentPorts.length; i++) { //map port to children
            let xyRefPoint = new Point(parentPorts[i].x, parentPorts[i].y)
            if (i < Settings.xPortCount * 2) {
                xyRefPoint.y = i % 2 == 0 ? findSnap(xyRefPoint.y + padding, "y") : findSnap(xyRefPoint.y - padding, "y") //up,down
            } else {
                xyRefPoint.x = i % 2 == 0 ? findSnap(xyRefPoint.x - padding, "x") : findSnap(xyRefPoint.x + padding, "x") //left,right
            }
            addBidirect(parentPorts[i].getUniqueKey(), xyRefPoint.getUniqueKey())
            parentPortsPadded.push(xyRefPoint)
        }
    }

    function checkParentPortsIntercept(a: Point, b: Point): Point | undefined {
        if (parentPortsPadded == []) return
        for (let i = 0; i < parentPortsPadded.length; i++) {
            let xy = parentPortsPadded[i]
            if (i < Settings.xPortCount * 2) {
                if (xy.x <= b.x && xy.x >= a.x && a.y == xy.y && b.y == a.y) return xy

            } else if (xy.y <= b.y && xy.y >= a.y && xy.x == a.x && a.x == b.x) return xy
        }
    }

    function fo(start: Point, end: Point) {
        let overlappedParentPort = checkParentPortsIntercept(start, end)
        let sk = start.getUniqueKey()
        let ek = end.getUniqueKey()
        let ok = overlappedParentPort.getUniqueKey()
        if (overlappedParentPort) {
            if (!(overlappedParentPort == end)) {
                addBidirect(sk, ok)
                addBidirect(ok, ek)
            } else addBidirect(sk, ek)
        } else addBidirect(sk, ek)
    }

    function fo1(x1: number, x2: number, y: number) {
        let start = new Point(x1, y)
        let end = new Point(x2, y)
        fo(start, end)
    }

    function fo2(x: number, y1: number, y2: number) {
        let start = new Point(x, y1)
        let end = new Point(x, y2)
        fo(start, end)
    }


    for (let i = 0; i < grects.length; i++) {
        let x1 = +(grects[i].getAttribute('x')) - padding,
            y1 = +(grects[i].getAttribute('y')) - padding;

        let child = grects[i].firstChild as any;
        RectPorts.set(child.id, Array<Point>())
        let width = +(child.style.width.replace('px', '')) + 2 * padding
        let height = +(child.style.height.replace('px', '')) + 2 * padding

        x1 = findSnap(x1, 'x')
        y1 = findSnap(y1, 'y')

        let x2 = findSnap(x1 + width, 'x')
        let y2 = findSnap(y1 + height, 'y')

        let xPorts = interpolate(x1, x2, Settings.xPortCount)
        let yPorts = interpolate(y1, y2, Settings.yPortCount)

        for (let i = 0; i < xPorts.length; i++) {
            if (i > 0 && i < xPorts.length - 1) {
                addBidirect(xPorts[i] + '_' + y1, xPorts[i] + '_' + (y1 + padding))
                RectPorts.get(child.id).push(new Point(xPorts[i], (y1 + padding))) //up

                addBidirect(xPorts[i] + "_" + y2, xPorts[i] + "_" + (y2 - padding))
                RectPorts.get(child.id).push(new Point(xPorts[i], (y1 - padding))) //down
            }
            if (i < xPorts.length - 1) {
                fo1(xPorts[i], xPorts[i + 1], y1)
                fo1(xPorts[i], xPorts[i + 1], y2)
            }
        }

        for (let i = 0; i < yPorts.length; i++) {
            if (i > 0 && i < yPorts.length - 1) {
                addBidirect((x2 - padding) + "_" + yPorts[i], x2 + "_" + yPorts[i])
                RectPorts.get(child.id).push(new Point(x2 - padding, yPorts[i])) //left

                addBidirect((x1 + padding) + "_" + yPorts[i], x1 + "_" + yPorts[i])
                RectPorts.get(child.id).push(new Point(x1 + padding, yPorts[i])) //right
            }
            if (i < yPorts.length - 1) {
                addBidirect(x1 + "_" + yPorts[i + 1], x1 + "_" + yPorts[i])
                addBidirect(x2 + "_" + yPorts[i + 1], x2 + "_" + yPorts[i])

                fo2(x1, yPorts[i], yPorts[i + 1])
                fo2(x2, yPorts[i], yPorts[i + 1])
            }
        }
    }
    return connectivity
}

export function DebugDrawConnectivity(graph, padding:number) {
    const base = d3.select('#base')
    Object.keys(graph).forEach(x1y1s => {
        let x1y1 = x1y1s.split('_');
        let x1 = +(x1y1[0])
        let y1 = +(x1y1[1])
        graph[x1y1s].forEach(x2y2 => {
            x2y2 = x2y2.split('_');
            let x2 = +(x2y2[0])
            let y2 = +(x2y2[1])

            base.append('line')
                .style("stroke", "red")
                .style("stroke-width", padding / 5)
                .attr("x1", x1)
                .attr("y1", y1)
                .attr("x2", x2)
                .attr("y2", y2);
        })
    })
}

export function FindBestPath(start: Point, end: Point, parentName: string) {
    let s1 = [
        [start]
    ]
    let covered = new Set([start])
    while (s1.length > 0) {
        let path = s1.shift()
        let lastNode = path.slice(-1)
        let neigh = []
        ConnectivityGraphs[parentName][lastNode].forEach(x => {
            if (!(covered.has(x))) neigh.push(x)
        })
        for (let i = 0; i < neigh.length; i++) {
            let n = neigh[i]
            if (n == end) {
                return path.concat(n)
            }
            covered.add(n)
            s1.push(path.concat(n))
        }
    }
    throw ("No path found, please increase pixelCorrection")
}


export function DrawLinks(n1:string, n2:string) {
    if (n1 == n2) return []
    if (n1.startsWith(n2) || n2.startsWith(n1)) return [] // parentof
    let p1 = n1.split('.').slice(0, -1).join('.')
    let p2 = n2.split('.').slice(0, -1).join('.')
    let n1s = n1.split('.')
    let n2s = n2.split('.')
    let n1level = n1s.length
    let n2level = n2s.length

    let n1out = RectPorts[n1][0]
    let n2in = RectPorts[n2][1]

    function drawSVGLines(nodes, l) {
        const base = d3.select('#base')
        if (!(l in DrawnLines)) DrawnLines[l] = new Set()
        for (let i = 0; i < nodes.length - 1; i++) {
            let xykey = [nodes[i], nodes[i + 1]].sort().join('.')
            if (DrawnLines[l].has(xykey)) continue

            let x1y1 = nodes[i].split('_');
            let x1 = +(x1y1[0])
            let y1 = +(x1y1[1])

            let x2y2 = nodes[i + 1].split('_');
            let x2 = +(x2y2[0])
            let y2 = +(x2y2[1])

            base.append('line')
                .style("stroke", Coloring.Line(l))
                .style("stroke-width", DepthPadding[l - 1] / 3)
                .attr("stroke-linecap", "round")
                .attr("x1", x1)
                .attr("y1", y1)
                .attr("x2", x2)
                .attr("y2", y2);
                DrawnLines[l].add(xykey);
        }
    }

    if (p1 == p2) {
        // if parents same, resolve internally   
        let bp = FindBestPath(n1out, n2in, p1)
        drawSVGLines(bp, n1s.length)
        return bp
    } else {
        // if diff parents
        let maxCommonLevel = Math.min(n1level, n2level)
        let baseNodes = []
        let commonParent = ''
        for (let lvl = 1; lvl <= maxCommonLevel; lvl++) {
            let n1p = n1s.slice(0, lvl).join('.')
            let n2p = n2s.slice(0, lvl).join('.')
            if (n1p != n2p) {
                baseNodes = DrawLinks(n1p, n2p)
                break
            } else {
                commonParent = n1p
            }
        }
        if (baseNodes.length > 0) {
            // baseNodes = commonParent.a1 -> commonParent.b1
            // [prepend] commonParent.a1.a2 to baseNodes
            // [append] commonParent.b1.b2 to baseNodes
            let commonPLvl = commonParent.split('.').length
            let prependID = n1s.slice(0, commonPLvl + 1).join('.')
            for (let i = commonPLvl + 2; i <= n1level; i++) {
                let newID = n1s.slice(0, i).join('.')
                let newIDPort = RectPorts[newID][0] // out
                let prependPort = RectPorts[prependID][0]
                if (prependPort != baseNodes[0]) {
                    throw ("Mismatched ports")
                }
                let nodes = FindBestPath(newIDPort, prependPort, n1s.slice(0, i - 1).join('.'))
                baseNodes = nodes.slice(0, -1).concat(baseNodes)
                prependID = newID
            }

            let appendID = n2s.slice(0, commonPLvl + 1).join('.')
            for (let i = commonPLvl + 2; i <= n2level; i++) {
                let newID = n2s.slice(0, i).join('.')
                let newIDPort = RectPorts[newID][1] // out
                let appendPort = RectPorts[appendID][1]
                if (appendPort != baseNodes[baseNodes.length - 1]) {
                    throw ("Mismatched ports")
                }
                let nodes = FindBestPath(appendPort, newIDPort, n2s.slice(0, i - 1).join('.'))
                baseNodes = baseNodes.slice(0, -1).concat(nodes)
                appendID = newID
            }
            drawSVGLines(baseNodes, n1s.length)
            return baseNodes
        }
        console.log('Bug: diff parents')
    }
}