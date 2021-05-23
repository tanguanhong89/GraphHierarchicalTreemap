import { Point, GraphHierarchicalTreemap as GHT, LinksWaitingList } from './dataStructures'
import * as d3 from 'd3'

class Snappables {
    x: Set<number>
    y: Set<number>
    constructor() {
        this.x = new Set<number>()
        this.y = new Set<number>()
    }
}

export function Interpolate(start: number, end: number, splitCnt: number) {
    let v = []
    let interval = (end - start) / (splitCnt + 1)
    for (let i = 0; i < splitCnt + 1; i++) v.push(Math.round(start + interval * i))
    v.push(end)
    return v
}

export function DrawPath(path, address, start) {
    // path is flattened 1D structure, no nested array due to difficulty of representing convergent relationships
    // TODO convergent relationships
    for (let i = start; i < path.length; i++) {
        let newNodes = DrawLinesFor2NodeIDs(path[i], path[i + 1])
        if (newNodes) {
            GetStrokeIDsFromNodePath(newNodes)
        } else {
            if (LinksWaitingList[path[i + 1]] == undefined)
                LinksWaitingList[path[i + 1]] = []
            LinksWaitingList[path[i + 1]].push([address, i + 1])
            break
        }
    }
}

export function CalculateConnectivity(currentID, padding, drawDebugLines) {
    function findSnap(v, k) {
        let vlist = k == 'x' ? snappables.x : snappables.y;
        vlist.forEach(x => {
            if (Math.abs(v - x) <= GHT.pixelCorrection) {
                v = x;
            }
        });
        if (k == 'x')
            snappables.x.add(v);
        else
            snappables.y.add(v);
        return v;
    }

    function addBidirect(ak, bk) {
        if (!(connectivity.has(ak))) connectivity.set(ak, new Set())
        if (!(connectivity.has(bk))) connectivity.set(bk, new Set())

        if (!(connectivity.get(ak).has(bk) && connectivity.get(bk).has(ak))) {
            connectivity.get(ak).add(bk)
            connectivity.get(bk).add(ak)
            if (drawDebugLines) {
                let c1 = function() { return Math.floor(Math.random() * 254) }
                const root = d3.select('#ght-root');
                ak = ak.split('_').map(x => +(x))
                bk = bk.split('_').map(x => +(x))
                root.append('line')
                    .style("stroke", ['rgb(', c1() + ',', c1() + ',', c1(), ')'].join(''))
                    .style("stroke-width", padding / 2)
                    .style("stroke-opacity", 1)
                    .attr("class", "st-" + ak + '-' + bk)
                    .attr("x1", ak[0])
                    .attr("y1", ak[1])
                    .attr("x2", bk[0])
                    .attr("y2", bk[1]);
                let a = 5; //for debugging
            }
        }

    }
    let connectivity = new Map();
    let snappables = new Snappables();
    padding = Math.round(padding / 2);
    let grects = $(GHT.nodeAddressLookup[currentID] != undefined ? ".p-" + GHT.nodeAddressLookup[currentID].concat(currentID).join('-') : ".p-" + currentID);
    let parentPorts = GHT.rectPorts.get(currentID);
    let parentPortsPadded = Array();
    if (parentPorts != undefined) {
        for (let i = 0; i < parentPorts.length; i++) { //map port to children
            let xyRefPoint = new Point(parentPorts[i].x, parentPorts[i].y);
            if (i < GHT.xPortCount * 2) {
                xyRefPoint.y = i % 2 == 0 ? findSnap(xyRefPoint.y + padding, "y") : findSnap(xyRefPoint.y - padding, "y"); //up,down
            } else {
                xyRefPoint.x = i % 2 == 0 ? findSnap(xyRefPoint.x + padding, "x") : findSnap(xyRefPoint.x - padding, "x"); //left,right
            }
            addBidirect(parentPorts[i].getUniqueKey(), xyRefPoint.getUniqueKey());
            parentPortsPadded.push(xyRefPoint);
        }
    }

    let danglingYsForXcols = {} //unconnected port ends
    let danglingXsForYrows = {}
    let rectPorts = []
    let x1y1x2y2 = []

    { // populating dangling points
        parentPortsPadded.forEach(p => {
            if (danglingYsForXcols[p.x] == undefined) danglingYsForXcols[p.x] = new Set()
            danglingYsForXcols[p.x].add(p.y)
            if (danglingXsForYrows[p.y] == undefined) danglingXsForYrows[p.y] = new Set()
            danglingXsForYrows[p.y].add(p.x)
        })
        for (let i = 0; i < grects.length; i++) {
            let x1 = +(grects[i].getAttribute('x')) - padding,
                y1 = +(grects[i].getAttribute('y')) - padding;
            let rect = grects[i].firstChild as any;
            let width = +(rect.style.width.replace('px', '')) + 2 * padding;
            let height = +(rect.style.height.replace('px', '')) + 2 * padding;
            x1 = findSnap(x1, 'x');
            y1 = findSnap(y1, 'y');
            let x2 = findSnap(x1 + width, 'x');
            let y2 = findSnap(y1 + height, 'y');
            let xPorts = Interpolate(x1, x2, GHT.xPortCount);
            let yPorts = Interpolate(y1, y2, GHT.yPortCount);
            rectPorts.push([xPorts, yPorts])
            x1y1x2y2.push([x1, y1, x2, y2])
            for (let ii = 0; ii < xPorts.length; ii++) {
                if (danglingYsForXcols[xPorts[ii]] == undefined) danglingYsForXcols[xPorts[ii]] = new Set()
                for (let jj = 0; jj < yPorts.length; jj++) {
                    if (danglingXsForYrows[yPorts[jj]] == undefined) danglingXsForYrows[yPorts[jj]] = new Set()
                    danglingYsForXcols[xPorts[ii]].add(yPorts[jj])
                    danglingXsForYrows[yPorts[jj]].add(xPorts[ii])
                }

            }
        }
        Object.keys(danglingYsForXcols).forEach(k => {
            danglingYsForXcols[k] = Array.from(danglingYsForXcols[k]).sort((a:number, b:number) => a - b)
        })
        Object.keys(danglingXsForYrows).forEach(k => {
            danglingXsForYrows[k] = Array.from(danglingXsForYrows[k]).sort((a:number, b:number) => a - b)
        })
    }


    for (let i = 0; i < grects.length; i++) {
        let rect = grects[i].firstChild as any;
        let rectID = rect.id.substr(4);
        GHT.rectPorts.set(rectID, Array());
        let xPorts = rectPorts[i][0];
        let yPorts = rectPorts[i][1];
        let x1 = x1y1x2y2[i][0],
            y1 = x1y1x2y2[i][1],
            x2 = x1y1x2y2[i][2],
            y2 = x1y1x2y2[i][3]
        for (let i = 0; i < xPorts.length - 1; i++) {
            let h2 = function(a) {
                let start = xPorts[i],
                    end = xPorts[i + 1]
                let danglingXs = danglingXsForYrows[a]
                for (let ii = 0; ii < danglingXs.length; ii++) {
                    if (danglingXs[ii] > start && danglingXs[ii] < end) {
                        addBidirect(start + "_" + a, danglingXs[ii] + "_" + a);
                        start = danglingXs[ii]
                    } else if (danglingXs[ii] >= end) {
                        addBidirect(start + "_" + a, end + "_" + a);
                        break
                    }
                }
            }
            h2(y1)
            h2(y2)
            if (i > 0 && i < xPorts.length - 1) {
                addBidirect(xPorts[i] + '_' + y1, xPorts[i] + '_' + (y1 + padding))
                GHT.rectPorts.get(rectID).push(new Point(xPorts[i], y1 + padding));
                addBidirect(xPorts[i] + '_' + y2, xPorts[i] + '_' + (y2 - padding))
                GHT.rectPorts.get(rectID).push(new Point(xPorts[i], y2 - padding));
            }
        }
        for (let i = 0; i < yPorts.length; i++) {
            let h2 = function(a) {
                let start = yPorts[i],
                    end = yPorts[i + 1]
                let danglingYs = danglingYsForXcols[a]
                for (let ii = 0; ii < danglingYs.length; ii++) {
                    if (danglingYs[ii] > start && danglingYs[ii] < end) {
                        addBidirect(a + '_' + start, a + '_' + danglingYs[ii]);
                        start = danglingYs[ii]
                    } else if (danglingYs[ii] >= end) {
                        addBidirect(a + '_' + start, a + '_' + end);
                        break
                    }
                }
            }
            h2(x1)
            h2(x2)
            if (i > 0 && i < yPorts.length - 1) {
                addBidirect(x1 + '_' + yPorts[i], (x1 + padding) + '_' + yPorts[i])
                GHT.rectPorts.get(rectID).push(new Point(x1 + padding, yPorts[i]));
                addBidirect(x2 + '_' + yPorts[i], (x2 - padding) + '_' + yPorts[i])
                GHT.rectPorts.get(rectID).push(new Point(x2 - padding, yPorts[i]));
            }
        }
    }
    return connectivity;
}

export function DebugDrawConnectivity(graph, padding) {
    const root = d3.select('#ght-root');
    let k = graph.keys();
    let c1 = function() { return Math.floor(Math.random() * 254) }
    while (true) {
        let next = k.next();
        if (next.done)
            break;
        let x1y1s = next.value;
        let x1y1 = x1y1s.split('_');
        let x1 = +(x1y1[0]);
        let y1 = +(x1y1[1]);
        graph.get(x1y1s).forEach(x2y2 => {
            x2y2 = x2y2.split('_');
            let x2 = +(x2y2[0]);
            let y2 = +(x2y2[1]);
            root.append('line')
                .style("stroke", 'white') //['rgb(', c1() + ',', c1() + ',', c1(), ')'].join(''))
                .style("stroke-width", padding / 5)
                .style("stroke-opacity", 0.3)
                .attr("x1", x1)
                .attr("y1", y1)
                .attr("x2", x2)
                .attr("y2", y2);
        });
    }
}

export function GetStrokeIDsFromNodePath(nodes) {
    let sid = []
    for (let i = 0; i < nodes.length - 1; i++)
        sid.push([nodes[i], nodes[i + 1]].join('-'))
    return sid
}

function findBestPath(start, end, parentName, depth) {
    if (start in GHT.drawnNodesOfSameDepth && end in GHT.drawnNodesOfSameDepth[start])
        return GHT.drawnNodesOfSameDepth[start][end];
    if (!(start in GHT.drawnNodesOfSameDepth))
        GHT.drawnNodesOfSameDepth[start] = new Map();
    if (!(end in GHT.drawnNodesOfSameDepth[start]))
        GHT.drawnNodesOfSameDepth[start][end] = Array();
    let s1 = [
        [start]
    ];
    let covered = new Set([start]);
    if (parentName == '' || parentName == undefined)
        parentName = 'root';
    while (s1.length > 0) {
        let path = s1.shift();
        let lastPoint = path.slice(-1)[0];
        let neigh = [];
        GHT.connectivityGraphs[parentName].get(lastPoint).forEach(x => {
            if (!(covered.has(x))) {
                let k1k2 = _getK1K2(lastPoint, x)
                if (GHT.drawnStokesForDepth[depth] != undefined)
                    if (GHT.drawnStokesForDepth[depth][k1k2[0]] != undefined)
                        if (GHT.drawnStokesForDepth[depth][k1k2[0]][k1k2[1]] != undefined) {
                            if (GHT.drawnStokesForDepth[depth][k1k2[0]][k1k2[1]] != k1k2[2])//opp direction, rejectpoint
                                return
                        }
                neigh.push(x)
            }
        });
        for (let i = 0; i < neigh.length; i++) {
            let n = neigh[i];
            if (n == end) {
                GHT.drawnNodesOfSameDepth[start][end] = path.concat(n);
                return GHT.drawnNodesOfSameDepth[start][end];
            }
            covered.add(n);
            s1.push(path.concat(n));
        }
    }
    return false
}

let _getK1K2 = function (n1, n2) {//left, top first
    //x,y
    let nn1 = n1.split('_').map(x => +(x))
    let nn2 = n2.split('_').map(x => +(x))
    if (nn1[0] < nn2[0])
        return [n1, n2, true]
    else if (nn2[0] < nn1[0])
        return [n2, n1, false]
    else if (nn1[1] < nn2[1])
        return [n1, n2, true]
    else if (nn2[1] < nn1[1])
        return [n2, n1, false]
}

function _drawLinesSameDepth(nodes, depth) {
    const layer = d3.select('.depth' + (depth - 1));
    if (!(depth in GHT.drawnStokesForDepth))
        GHT.drawnStokesForDepth[depth] = new Set();
    for (let i = 0; i < nodes.length - 1; i++) {
        let k1k2 = _getK1K2(nodes[i], nodes[i + 1])
        if (GHT.drawnStokesForDepth[depth][k1k2[0]] != undefined) {
            if (GHT.drawnStokesForDepth[depth][k1k2[0]][k1k2[1]] != undefined)
                continue;
        } else
            GHT.drawnStokesForDepth[depth][k1k2[0]] = {};
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
            .attr("class", "st-" + [nodes[i], nodes[i + 1]].join('-'))
            .attr("stroke-linecap", "round")
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x2)
            .attr("y2", y2)
            .attr("depth", depth);
        GHT.drawnStokesForDepth[depth][k1k2[0]][k1k2[1]] = k1k2[2];
    }
}

function DrawLinesFor2NodeIDs(n1, n2) {
    if (GHT.nodeAddressLookup[n1] == undefined || GHT.nodeAddressLookup[n2] == undefined)
        return false;
    let exit1 = 0,
        enter1 = 0;
    if (GHT.drawnNodesBetween2ImmediateNodeIDs[n1]) {
        if (GHT.drawnNodesBetween2ImmediateNodeIDs[n1][n2])
            return GHT.drawnNodesBetween2ImmediateNodeIDs[n1][n2];
    } else
        GHT.drawnNodesBetween2ImmediateNodeIDs[n1] = {};
    if (n1 in GHT.drawnNodesOfSameDepth && n2 in GHT.drawnNodesOfSameDepth[n1])
        return GHT.drawnNodesOfSameDepth[n1][n2];
    if (n1 == n2)
        return [];
    let n1s = GHT.nodeAddressLookup[n1].concat([n1]);
    let n2s = GHT.nodeAddressLookup[n2].concat([n2]);
    let n1level = n1s.length;
    let n2level = n2s.length;
    let maxDrawDepth = Math.max(n1level, n2level);
    let maxCommonLevel = Math.min(n1level, n2level);
    let baseNodes = [];
    let commonPLvl = 0;
    let h1 = function(n, p) {
        return GHT.rectPorts.get(n)[p].getUniqueKey();
    };
    let n1ss = n1s.join("."),
        n2ss = n2s.join(".");
    let h2 = function(par, child, k) {
        let n1 = findBestPath(h1(child[maxCommonLevel], k), h1(par[maxCommonLevel - 1], k), par[maxCommonLevel - 1], maxCommonLevel);
        if (n1)
            if (n1.length < baseNodes.length && n1.length > 0 || baseNodes.length == 0)
                baseNodes = n1, enter1 = k, exit1 = k;
    };
    if (n1ss.startsWith(n2ss)) {
        h2(n1s.slice(0, -1), n1s, 0);
        h2(n1s.slice(0, -1), n1s, 1);
        h2(n1s.slice(0, -1), n1s, 2);
        h2(n1s.slice(0, -1), n1s, 3);
        _drawLinesSameDepth(baseNodes, n1s.length);

        let a = n1s,
            b = n1s.slice(0, -1);
        let _baseNodes = baseNodes
        while (b.join('.') != n2ss) {
            baseNodes = []
            a = b;
            b = b.slice(0, -1);
            h2(b, a, enter1);
            _drawLinesSameDepth(baseNodes, a.length);
            _baseNodes.concat(baseNodes)
        }
        baseNodes = _baseNodes
        GHT.drawnNodesBetween2ImmediateNodeIDs[n1][n2] = baseNodes;
        return baseNodes;
    } else if (n2ss.startsWith(n1ss)) {
        h2(n2s.slice(0, -1), n2s, 0);
        h2(n2s.slice(0, -1), n2s, 1);
        h2(n2s.slice(0, -1), n2s, 2);
        h2(n2s.slice(0, -1), n2s, 3);
        _drawLinesSameDepth(baseNodes, n2s.length);

        let a = n2s,
            b = n2s.slice(0, -1);
        let _baseNodes = baseNodes
        while (b.join('.') != n1ss) {
            baseNodes = []
            a = b;
            b = b.slice(0, -1);
            h2(b, a, enter1);
            _drawLinesSameDepth(baseNodes, a.length);
            _baseNodes.concat(baseNodes)
        }
        baseNodes = _baseNodes
        GHT.drawnNodesBetween2ImmediateNodeIDs[n2][n1] = baseNodes;
        return baseNodes;
    } else {
        for (let lvl = 1; lvl < maxCommonLevel; lvl++) {
            let n1p = n1s[lvl];
            let n2p = n2s[lvl];
            if (n1p != n2p || lvl == maxCommonLevel) {
                let h2 = function(a, b) {
                    let _t = findBestPath(h1(n1p, a), h1(n2p, b), n1s[lvl - 1], lvl);
                    if (_t)
                        if (_t.length < baseNodes.length && _t.length > 0)
                            baseNodes = _t, exit1 = a, enter1 = b;
                        else if (baseNodes.length == 0)
                        baseNodes = _t, exit1 = a, enter1 = b;
                };
                h2(0, 0);
                h2(0, 1);
                h2(1, 0);
                h2(1, 1);
                h2(2, 2);
                h2(2, 3);
                h2(3, 2);
                h2(3, 3);
                commonPLvl = lvl;
                for (let i = lvl; i < maxDrawDepth; i++)
                    if (i > 0)
                        _drawLinesSameDepth(baseNodes, i);
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
                let newIDPort = h1(newID, exit1);
                let prependPort = h1(prependID, exit1);
                if (prependPort != baseNodes[0]) {
                    throw ("Mismatched ports");
                }
                let nodes = findBestPath(newIDPort, prependPort, prependID, i);
                if (nodes) {
                    for (let ii = i; ii < maxDrawDepth; ii++)
                        _drawLinesSameDepth(nodes, ii);
                    baseNodes = nodes.slice(0, -1).concat(baseNodes);
                    prependID = newID;
                } else
                    break;
            }
            let appendID = n2s[commonPLvl];
            for (let i = commonPLvl + 1; i < n2level; i++) {
                let newID = n2s[i];
                let newIDPort = h1(newID, enter1); // if undefined, parent is not rendered
                let appendPort = h1(appendID, enter1);
                if (appendPort != baseNodes[baseNodes.length - 1]) {
                    throw ("Mismatched ports");
                }
                let nodes = findBestPath(appendPort, newIDPort, appendID, i);
                if (nodes) {
                    for (let ii = i; ii < maxDrawDepth; ii++)
                        _drawLinesSameDepth(nodes, ii);
                    baseNodes = baseNodes.slice(0, -1).concat(nodes);
                    appendID = newID;
                } else
                    break;
            }
            GHT.drawnNodesBetween2ImmediateNodeIDs[n1][n2] = baseNodes;
            return baseNodes;
        }
    }

    console.log('Bug: diff parents');
    return false;
}

export function FindArbDistance(a: Point, b: Point) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}