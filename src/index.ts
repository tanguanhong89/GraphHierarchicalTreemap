import { HierarchicalNode, RootNode, GraphHierarchicalTreemap as GHT, LinksWaitingList } from './dataStructures'
import * as d3 from 'd3'
import { CalculateConnectivity, DebugDrawConnectivity, DrawPath, GetStrokeIDsFromNodePath } from './connectivity';
/*
    For parent-child flow, only child to parent direction is possible.
    No immediate self directed path. eg [1,2,2,3]. 2 directs to itself next. However, [1,2,3,2] is possible
*/
function drawGraphHierarchicalTreemap(nodes, links, rectColoring, lineColoring, drawDebugLines = false, preroutes) {
    if (!preroutes && nodes.n == 'root') {
        RootNode.name = nodes.n;
        RootNode.value = nodes.v;
        preroutes = [];
        if (!GHT.coloring.rect)
            GHT.coloring.rect = rectColoring ? rectColoring : createDefaultColorScheme(nodes);
        if (!GHT.coloring.line)
            GHT.coloring.line = lineColoring ? lineColoring : d3.scaleSequential([GHT.maxDepth, 0], d3.interpolateSinebow);
    }
    GHT.nodes = nodes, GHT.links = links
    createHierarchicalTreemap(nodes, drawDebugLines, preroutes);
    var element = document.querySelector('#svg');

    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type == "attributes") {
                resetRelabelFocusedNodes()
            }
        });
    });

    observer.observe(element, {
        attributes: true //configure it to listen to attribute changes
    });
}


function drawTreemap(d1, drawDebugLines, preroutes) {
    let drawnAny = false;
    let depth = preroutes.length;
    if (d1.children.length == 0)
        return true;
    let id = d1.n;
    let oid = "#ght-" + id;
    let o = $(oid)[0];
    if (o == undefined)
        return drawnAny;
    let width = +(o.style.width.replace("px", ""));
    let height = +(o.style.height.replace("px", ""));
    let padding = width / 30 + depth;
    if (!(depth in GHT.depthPadding))
        GHT.depthPadding[depth] = padding;
    else
        GHT.depthPadding[depth] = GHT.depthPadding[depth] * 4 / 5 + padding * 1 / 5;
    if (depth > 0)
        if (GHT.depthPadding[depth - 1] < GHT.depthPadding[depth])
            GHT.depthPadding[depth] = GHT.depthPadding[depth - 1] * 7 / 8;
    d1.v = 0;
    let treemap = (d1) => d3
        .treemap()
        .tile(d3.treemapSquarify.ratio(1.1))
        .size([width, height])
        .paddingOuter(padding)
        .paddingInner(padding)
        .round(true)(d3.hierarchy(d1).sum(d => d.v));
    const treemapd = treemap(d1);
    let dataGrp = d3.group(treemapd, (d) => d.depth);
    let gid = "#g-" + id;
    gid = gid.replace(/\./g, '\\.');
    let g = $(gid)[0];
    let xoffset = g == undefined ? 0 : +(g.getAttribute('x'));
    let yoffset = g == undefined ? 0 : +(g.getAttribute('y'));
    let parentLayer = dataGrp.get(0);
    let childrenLayer = dataGrp.get(1);

    function h1(d, dep, p) {
        if ((d.x1 - d.x0) < GHT.minPxSize || (d.y1 - d.y0) < GHT.minPxSize) { } else {
            drawnAny = true;
            if (GHT.nodeAddressLookup[d.data.n] == undefined) {
                let depthClass = "depth" + dep;
                let gclass = d3.select('.' + depthClass).size() > 0 ? d3.select('.' + depthClass) : d3.select("#ght-root").append('g')
                    .attr("class", depthClass);
                let g = gclass.append('g');
                let pclass = "p-" + (p != undefined ? p : "");
                g.attr("transform", `translate(${xoffset + d.x0},${yoffset + d.y0})`)
                    .attr("x", xoffset + d.x0) //does nothing, for easier ref
                    .attr("y", yoffset + d.y0) //does nothing, for easier ref
                    .attr("class", pclass)
                    .attr("id", "g-" + d.data.n);
                let rect = g.append("rect")
                    .attr("id", "ght-" + d.data.n)
                    .style("width", (d.x1 - d.x0) + "px")
                    .style("height", (d.y1 - d.y0) + "px");
                if (d.data.n != "root")
                    rect.on("mouseover", mouseover)
                        .on("mousemove", mousemove)
                        .on("mouseleave", mouseleave);
                if (d.data.n != 'root') {
                    rect.style("fill", GHT.coloring.rect(preroutes.length > 1 ? preroutes[1] : d.data.n)(dep));
                    RootNode.addGrandchild(preroutes, (new HierarchicalNode(d.data.n, d.data.v)));
                }
            }
        }
    }
    parentLayer.forEach(d => h1(d, depth, preroutes.join('-')));
    preroutes = preroutes.concat([d1.n]);
    childrenLayer.forEach(d => h1(d, depth + 1, preroutes.join('-')));
    let graph = CalculateConnectivity(d1.n, padding, drawDebugLines);
    GHT.connectivityGraphs[d1.n] = graph;
    if (drawDebugLines)
        DebugDrawConnectivity(graph, padding);
    //draw links whichever renders last    
    if (drawnAny) // drawnAny, if any rects are drawn at all
        d1.children.forEach(x => {
            // clear backlogs first
            if (LinksWaitingList[x.n] != undefined)
                LinksWaitingList[x.n].forEach(d => { // [address, ii + 1]
                    let path1 = GHT.links[d[0][0]][d[0][1]]
                    path1 = [d[0][0]].concat(path1);
                    DrawPath(path1, d[0], d[1] - 1);
                })

            if (x.n in GHT.links) {
                let paths = GHT.links[x.n]
                if (GHT.nodePathIndex[x.n] == undefined)
                    GHT.nodePathIndex[x.n] = []
                for (let pi = 0; pi < paths.length; pi++) {
                    GHT.nodePathIndex[x.n].push([x.n, pi])
                    paths[pi].forEach(n => {
                        if (GHT.nodePathIndex[n] == undefined)
                            GHT.nodePathIndex[n] = []
                        GHT.nodePathIndex[n].push([x.n, pi])
                    })
                    DrawPath([x.n].concat(paths[pi]), [x.n, pi], 0);
                }
            }
        });
    return drawnAny;
}

function createDefaultColorScheme(node) {
    let h1 = (a) => {
        return d3.scaleSequential([GHT.maxDepth, 0], a);
    };
    let colorSchemeList = [
        h1(d3.interpolateInferno),
        h1(d3.interpolateViridis),
        h1(d3.interpolateTurbo),
        h1(d3.interpolateRdYlGn),
        h1(d3.interpolateCool),
        h1(d3.interpolateWarm),
        h1(d3.interpolateBrBG),
        h1(d3.interpolateSinebow),
        h1(d3.interpolatePiYG),
        h1(d3.interpolateRainbow),
        h1(d3.interpolatePRGn),
    ]

    let colorMap = new Map<String, any>()
    node.c.forEach(c => {
        let n = Math.floor(Math.random() * colorSchemeList.length)
        colorMap.set(c.n, colorSchemeList[n])
    })
    return function (n: string) {
        return colorMap.get(n) ? colorMap.get(n) : d3.scaleSequential([GHT.maxDepth, 0], d3.interpolateBlues)
    }
}

function findEstimatedLargerSqrt(n: number) {
    let nn = Math.max(1, n / 1000 | 0), i = 1;
    for (i = 1; i < n / 2; i += nn) {
        if (i * i > n) return i
    }
    return i
}


function createHierarchicalTreemap(node: any, drawDebugLines = false, preroutes: Array<string>) {
    if ('c' in node) {
        let mxV = 0, sV = 0;
        node.c.forEach(c => {
            c.v = findEstimatedLargerSqrt(c.v);
            mxV = Math.max(mxV, c.v)
        })

        let currentNode = {
            n: node.n, v: node.v, children: []
        }
        node.c.forEach(c => {
            currentNode.children.push({ n: c.n, v: c.v * mxV, children: [] })
            sV += c.v * mxV
        })
        currentNode.v = sV
        if (drawTreemap(currentNode, drawDebugLines, preroutes)) {
            preroutes = preroutes.concat(node.n)
            node.c.forEach(w => {
                setTimeout(() => {
                    createHierarchicalTreemap(w, drawDebugLines, preroutes)
                }, 0)
            })
        }
    }
}

var Tooltip = createTooltip()

function createTooltip() {
    return d3.select("#svg-container")
        .append("div")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("padding", "5px");
}

function mouseover(d) {
    if (!GHT.mouseoverState) {
        let thisID = this.id.substr(4);
        GHT.mouseoverState = true;
        Tooltip.style("opacity", 1);
        Tooltip.html(thisID);
        d3.selectAll('rect').style("opacity", 0.1);
        d3.selectAll('line').style("stroke-opacity", 0.1);
        d3.select(this).style("opacity", 1);
        d3.selectAll("g[class^='p-" + GHT.nodeAddressLookup[thisID].concat(thisID).join('-') + "']").selectAll('rect').style("opacity", 1);
        if (GHT.nodePathIndex[thisID] != undefined) {
            let pathIndices = GHT.nodePathIndex[thisID];
            GHT.tpath = [];
            GHT.tnode = this.id.substr(4);
            pathIndices.forEach(pathIndex => {
                let nodePath = [pathIndex[0]].concat(GHT.links[pathIndex[0]][pathIndex[1]]);
                GHT.tpath.push(nodePath);

                resetRelabelFocusedNodes();
                for (let i = 0; i < nodePath.length; i++) {
                    if (i < nodePath.length - 1) {
                        d3.select('#ght-' + nodePath[i]).style("opacity", 1), d3.select('#ght-' + nodePath[i + 1]).style("opacity", 1);
                        if (GHT.drawnNodesBetween2ImmediateNodeIDs[nodePath[i]] == undefined) {
                            console.log("Path error:" + nodePath);
                            break;
                        }
                        let strokePath = GHT.drawnNodesBetween2ImmediateNodeIDs[nodePath[i]][nodePath[i + 1]];
                        if (strokePath != undefined) {
                            let strokeIDs = GetStrokeIDsFromNodePath(strokePath);
                            strokeIDs.forEach(s => {
                                d3.selectAll('.st-' + s).style("stroke-opacity", 1);
                                GHT.tcircles.push(applyDirectionalMovementToStroke(s, +(d3.select('.st-' + s).style("stroke-width").replace('px', '')) / 2));
                            });
                        } else {
                            let p1 = GHT.nodeAddressLookup[nodePath[i]];
                            let p2 = GHT.nodeAddressLookup[nodePath[i + 1]];
                            console.log("Path error:" + p1 + ":" + nodePath[i] + "     " + p2 + ":" + nodePath[i + 1]);
                            break;
                        }
                    }
                }
            });
        }
    }
}


function mousemove(d) {
    Tooltip.html(this.id.substr(4))
        .style("left", (d.x + 20) + "px")
        .style("top", (d.y - 40) + "px");
}

function mouseleave(d) {
    GHT.mouseoverState = false;
    while (GHT.tcircles.length > 0)
        clearInterval(GHT.tcircles.shift());
    d3.selectAll('.ght-tcircle').remove();
    d3.selectAll('.ght-ttooltip').remove();
    Tooltip.style("opacity", 0);
    d3.selectAll('rect').style("opacity", 1);
    d3.selectAll('line').style("stroke-opacity", 1);
}


function applyDirectionalMovementToStroke(s, r) {
    let tinterval = 2000
    let startend = s.split('-').map(x => x.split('_').map(xx => +(xx)))

    let h1 = function () {
        var t = d3.transition()
            .duration(tinterval)
            .ease(d3.easeLinear);
        d3.select('svg').append('circle').attr('class', 'ght-tcircle')
            .attr('cx', startend[0][0])
            .attr('cy', startend[0][1])
            .attr('r', r)
            .attr('fill', 'red')
            .transition(t)
            .attr('cx', startend[1][0])
            .attr('cy', startend[1][1])
            .remove()
    }
    h1()
    return setInterval(() => { h1() }, tinterval)
}

function resetRelabelFocusedNodes() {
    d3.selectAll('.ght-ttooltip').remove();
    GHT.tpath.forEach(path => {
        for (let i = 0; i < path.length; i++) {
            if (GHT.tnode != path[i]) {
                let domPos = $('#ght-' + path[i])[0].getBoundingClientRect();
                let tooltipX = createTooltip();
                tooltipX.html(path[i]).style("opacity", 1)
                    .attr("class", "tooltip ght-ttooltip");
                let left = domPos.x,
                    top = domPos.y;
                if (domPos.left > 0)
                    left = domPos.left;
                else if (domPos.right > 0)
                    left = domPos.right;
                if (domPos.top > 0)
                    top = domPos.top;
                else if (domPos.bottom > 0)
                    top = domPos.bottom;
                tooltipX.style("left", (left + 20) + "px")
                    .style("top", (top - 40) + "px");
            }
        }
    })
}