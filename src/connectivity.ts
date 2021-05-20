import { Point, GraphHierarchicalTreemap as GHT, LinksWaitingList } from './dataStructures'
import * as d3 from 'd3'
import { NodeLookup } from 'dataStructures'

class Snappables {
    x: Set<number>
    y: Set<number>
    constructor() {
        this.x = new Set<number>()
        this.y = new Set<number>()
    }
}

export function DrawPath(path, address, start) {
    // path is flattened 1D structure, no nested array due to difficulty of representing convergent relationships
    // TODO convergent relationships
    for (let i = start; i < path.length; i++) {
        if (!DrawLinesFor2Points(path[i], path[i + 1])) {
            if (LinksWaitingList[path[i + 1]] == undefined)
                LinksWaitingList[path[i + 1]] = []
            LinksWaitingList[path[i + 1]].push([address, i + 1])
            break
        }
    }
}

export function CalculateConnectivity(currentID: string, padding: number): Map<string, Set<string>> {
    let connectivity = new Map<string, Set<string>>()
    let snappables = new Snappables()

    padding = Math.round(padding / 2)
    let grects = $(NodeLookup[currentID] != undefined ? ".p-" + NodeLookup[currentID].concat(currentID).join('.').replaceAll('.', '\\.') : ".p-" + currentID)

    function findSnap(v: number, k: string): number { //snap to either existing x's or y's
        let vlist = k == 'x' ? snappables.x : snappables.y
        vlist.forEach(x => {
            if (Math.abs(v - x) <= GHT.pixelCorrection) {
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

    let parentPorts = GHT.rectPorts.get(currentID)
    let parentPortsPadded = Array<Point>()
    if (parentPorts != undefined) {
        for (let i = 0; i < parentPorts.length; i++) { //map port to children
            let xyRefPoint = new Point(parentPorts[i].x, parentPorts[i].y)
            if (i < GHT.xPortCount * 2) {
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
            if (i < GHT.xPortCount * 2) {
                if (xy.x <= b.x && xy.x >= a.x && a.y == xy.y && b.y == a.y) return xy

            } else if (xy.y <= b.y && xy.y >= a.y && xy.x == a.x && a.x == b.x) return xy
        }
    }

    function fo(start: Point, end: Point) {
        let overlappedParentPort = checkParentPortsIntercept(start, end)
        let sk = start.getUniqueKey()
        let ek = end.getUniqueKey()
        if (overlappedParentPort) {
            if (!(overlappedParentPort == end)) {
                let ok = overlappedParentPort.getUniqueKey()
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
        GHT.rectPorts.set(child.id, Array<Point>())
        let width = +(child.style.width.replace('px', '')) + 2 * padding
        let height = +(child.style.height.replace('px', '')) + 2 * padding

        x1 = findSnap(x1, 'x')
        y1 = findSnap(y1, 'y')

        let x2 = findSnap(x1 + width, 'x')
        let y2 = findSnap(y1 + height, 'y')

        let xPorts = interpolate(x1, x2, GHT.xPortCount)
        let yPorts = interpolate(y1, y2, GHT.yPortCount)

        for (let i = 0; i < xPorts.length; i++) {
            if (i > 0 && i < xPorts.length - 1) {
                addBidirect(xPorts[i] + '_' + y1, xPorts[i] + '_' + (y1 + padding))
                GHT.rectPorts.get(child.id).push(new Point(xPorts[i], (y1 + padding))) //up

                addBidirect(xPorts[i] + "_" + y2, xPorts[i] + "_" + (y2 - padding))
                GHT.rectPorts.get(child.id).push(new Point(xPorts[i], (y2 - padding))) //down
            }
            if (i < xPorts.length - 1) {
                fo1(xPorts[i], xPorts[i + 1], y1)
                fo1(xPorts[i], xPorts[i + 1], y2)
            }
        }

        for (let i = 0; i < yPorts.length; i++) {
            if (i > 0 && i < yPorts.length - 1) {
                addBidirect((x2 - padding) + "_" + yPorts[i], x2 + "_" + yPorts[i])
                GHT.rectPorts.get(child.id).push(new Point(x2 - padding, yPorts[i])) //left

                addBidirect((x1 + padding) + "_" + yPorts[i], x1 + "_" + yPorts[i])
                GHT.rectPorts.get(child.id).push(new Point(x1 + padding, yPorts[i])) //right
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

export function DebugDrawConnectivity(graph, padding: number) {
    const root = d3.select('#root')
    let k = graph.keys()
    while (true) {
        let next = k.next()
        if (next.done) break
        let x1y1s = next.value
        let x1y1 = x1y1s.split('_')
        let x1 = +(x1y1[0])
        let y1 = +(x1y1[1])
        graph.get(x1y1s).forEach(x2y2 => {
            x2y2 = x2y2.split('_');
            let x2 = +(x2y2[0])
            let y2 = +(x2y2[1])

            root.append('line')
                .style("stroke", "red")
                .style("stroke-width", padding / 5)
                .attr("x1", x1)
                .attr("y1", y1)
                .attr("x2", x2)
                .attr("y2", y2);
        })
    }
}

export function FindBestPath(start, end, parentName) {
    if (start in GHT.drawnLinks && end in GHT.drawnLinks[start])
        return GHT.drawnLinks[start][end];
    if (!(start in GHT.drawnLinks))
        GHT.drawnLinks[start] = new Map();
    if (!(end in GHT.drawnLinks[start]))
        GHT.drawnLinks[start][end] = Array();
    let s1 = [
        [start]
    ];
    let covered = new Set([start]);
    if (parentName == '' || parentName == undefined)
        parentName = 'root';
    while (s1.length > 0) {
        let path = s1.shift();
        let lastNode = path.slice(-1)[0];
        let neigh = [];
        GHT.connectivityGraphs[parentName].get(lastNode).forEach(x => {
            if (!(covered.has(x)))
                neigh.push(x);
        });
        for (let i = 0; i < neigh.length; i++) {
            let n = neigh[i];
            if (n == end) {
                GHT.drawnLinks[start][end] = path.concat(n);
                return GHT.drawnLinks[start][end];
            }
            covered.add(n);
            s1.push(path.concat(n));
        }
    }
    throw ("No path found, please increase pixelCorrection");
}
function drawSVGLines(nodes, depth) {
    const layer = d3.select('.depth' + (depth - 1));
    if (!(depth in GHT.drawnLines))
        GHT.drawnLines[depth] = new Set();
    for (let i = 0; i < nodes.length - 1; i++) {
        let xykey = [nodes[i], nodes[i + 1]].sort().join('.');
        if (GHT.drawnLines[depth].has(xykey))
            continue;
        let x1y1 = nodes[i].split('_');
        let x1 = +(x1y1[0]);
        let y1 = +(x1y1[1]);
        let x2y2 = nodes[i + 1].split('_');
        let x2 = +(x2y2[0]);
        let y2 = +(x2y2[1]);
        let width = Math.floor(GHT.depthPadding[depth - 1] / 4);
        let line = layer.append('line')
            .style("stroke", GHT.coloring.line(depth))
            .style("stroke-width", width == 0 ? 1 : width)
            .attr("stroke-linecap", "round")
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x2)
            .attr("y2", y2)
            .attr("depth", depth);
        GHT.drawnLines[depth].add(xykey);
    }
}

function DrawLinesFor2Points(n1, n2) {
    if (NodeLookup[n1] == undefined || NodeLookup[n2] == undefined) return false
    let exitp = 0,
        enter1 = 1;
    if (n1 in GHT.drawnLinks && n2 in GHT.drawnLinks[n1])
        return GHT.drawnLinks[n1][n2];
    if (n1 == n2)
        return [];
    let n1s = NodeLookup[n1].concat([n1]);
    let n2s = NodeLookup[n2].concat([n2]);
    let n1ss = n1s.join("."),
        n2ss = n2s.join(".");
    if (n1ss.startsWith(n2ss)) {
        enter1 = 0;
    }
    if (n2ss.startsWith(n1ss)) {
        enter1 = 0;
        n2ss = [n1ss, n1ss = n2ss][0];
    }
    let n1level = n1s.length;
    let n2level = n2s.length;
    let maxDrawDepth = Math.max(n1level, n2level);
    let maxCommonLevel = Math.min(n1level, n2level);
    let baseNodes = [];
    let commonPLvl = 0;
    for (let lvl = 0; lvl <= maxCommonLevel; lvl++) {
        let n1p = n1s[lvl];
        let n2p = lvl == maxCommonLevel ? n2s[lvl - 1] : n2s[lvl];
        if (n1p != n2p || lvl == maxCommonLevel) {
            baseNodes = FindBestPath(GHT.rectPorts.get(n1p)[exitp].getUniqueKey(), GHT.rectPorts.get(n2p)[enter1].getUniqueKey(), n1s[lvl - 1]);
            commonPLvl = lvl;
            for (let i = lvl; i < maxDrawDepth; i++)
                if (i > 0)
                    drawSVGLines(baseNodes, i);
            break;
        }
    }
    if (baseNodes.length > 0) {
        // baseNodes = commonParent.a1 -> commonParent.b1
        // [prepend] commonParent.a1.a2 to baseNodes
        // [append] commonParent.b1.b2 to baseNodes
        let prependID = n1s[commonPLvl];
        for (let i = commonPLvl + 1; i < n1level; i++) {
            let newID = n1s[i];
            let newIDPort = GHT.rectPorts.get(newID)[0].getUniqueKey(); // out
            let prependPort = GHT.rectPorts.get(prependID)[0].getUniqueKey();
            if (prependPort != baseNodes[0]) {
                throw ("Mismatched ports");
            }
            let nodes = FindBestPath(newIDPort, prependPort, prependID);
            for (let ii = i; ii < maxDrawDepth; ii++)
                drawSVGLines(nodes, ii);
            baseNodes = nodes.slice(0, -1).concat(baseNodes);
            prependID = newID;
        }
        let appendID = n2s[commonPLvl];
        for (let i = commonPLvl + 1; i < n2level; i++) {
            let newID = n2s[i];
            let newIDPort = GHT.rectPorts.get(newID)[1].getUniqueKey(); // if undefined, parent is not rendered
            let appendPort = GHT.rectPorts.get(appendID)[1].getUniqueKey();
            if (appendPort != baseNodes[baseNodes.length - 1]) {
                throw ("Mismatched ports");
            }
            let nodes = FindBestPath(appendPort, newIDPort, appendID);
            for (let ii = i; ii < maxDrawDepth; ii++)
                drawSVGLines(nodes, ii);
            baseNodes = baseNodes.slice(0, -1).concat(nodes);
            appendID = newID;
        }
        //drawSVGLines(baseNodes, Math.max(n1level, n2level))
        return baseNodes;
    }
    console.log('Bug: diff parents');
    return false
}