import { HierarchicalNode, RootNode, GraphHierarchicalTreemap as GHT } from './dataStructures'
import * as d3 from 'd3'
import { CalculateConnectivity, DebugDrawConnectivity, DrawLinks } from './connectivity';

function drawGraphHierarchicalTreemap(node: any, links: any, rectColoring: any, lineColoring: any, drawDebugLines = false, preroutes: Array<string>) {
    if (!preroutes && node.n == 'root') {
        RootNode.name = node.n
        RootNode.value = node.v
        preroutes = []

        if (!GHT.coloring.rect)
            GHT.coloring.rect = rectColoring ? rectColoring : createDefaultColorScheme(node)
        if (!GHT.coloring.line)
            GHT.coloring.line = lineColoring ? lineColoring : d3.scaleSequential([GHT.maxDepth, 0], d3.interpolateSinebow)


        //needed bidirectional because of async rendering of rects, true means src->dst, false means dst->src
        let biDirLinks = new Map<string, Map<string, boolean>>()
        Object.keys(links).forEach(src => {
            if (!(src in biDirLinks)) biDirLinks[src] = new Map<string, boolean>()
            let dsts = links[src]
            dsts.forEach(dst => {
                if (!(dst in biDirLinks)) biDirLinks[dst] = new Map<string, boolean>()
                biDirLinks[src][dst] = true
                biDirLinks[dst][src] = false
            })
        })
        links = biDirLinks
    }
    createHierarchicalTreemap(node, links, drawDebugLines, preroutes)
}


function drawTreemap(d1: any, links: Map<string, Set<string>>, drawDebugLines: boolean, preroutes: Array<string>) {
    let ifBreak = false
    let depth = d1.n == 'root' ? 0 : preroutes.length + 1
    if (d1.children.length == 0) return true
    let id = preroutes.concat([d1.n]).join('.')
    let oid = "#" + id;
    oid = oid.replace(/\./g, '\\.')
    let o = $(oid)[0];

    let width = +(o.style.width.replace("px", ""))
    let height = +(o.style.height.replace("px", ""));
    let padding = width / 30 + depth;
    if (!(depth in GHT.depthPadding)) GHT.depthPadding[depth] = padding;
    d1.v = 0;
    let treemap = (d1) =>
        d3
            .treemap()
            .tile(d3.treemapSquarify.ratio(1.1))
            .size([width, height])
            .paddingOuter(padding)
            .paddingInner(padding)
            .round(true)(d3.hierarchy(d1).sum(d => d.v));
    const treemapd = treemap(d1);

    let dataGrp = d3.group(treemapd, (d) => d.depth) as any;

    let gid = "#g-" + id;
    gid = gid.replace(/\./g, '\\.')
    let g = $(gid)[0];
    let xoffset = g == undefined ? 0 : +(g.getAttribute('x'));
    let yoffset = g == undefined ? 0 : +(g.getAttribute('y'));

    let parentLayer = dataGrp.get(0)
    let childrenLayer = dataGrp.get(1)

    function h1(d, r1, dep) {
        if ((d.x1 - d.x0) < GHT.minPxSize || (d.y1 - d.y0) < GHT.minPxSize) {
            ifBreak = true
        } else {
            if (!RootNode.find(r1).drawn) {
                let g = d3.select("#root").append('g');
                let pclass = "p" + (r1.length == 0 ? "graphhierarchicaltreemap" : r1.length == 1 ? "root" : r1.slice(0, -1).join('.'))
                let depthClass = "depth" + (r1.length == 0 ? "-" : r1.slice(0, -1).length + 1)
                g.attr("transform", `translate(${xoffset + d.x0},${yoffset + d.y0})`)
                    .attr("x", xoffset + d.x0) //does nothing, for easier ref
                    .attr("y", yoffset + d.y0) //does nothing, for easier ref
                    .attr("class", [pclass, depthClass].join(' '))
                    .attr("id", "g-" + r1.join('.'));

                let rect = g.append("rect")
                    .attr("id", r1.join('.'))
                    .style("width", (d.x1 - d.x0) + "px")
                    .style("height", (d.y1 - d.y0) + "px")
                if (d.data.n != 'root') rect.style("fill", GHT.coloring.rect(r1[0])(dep))

                RootNode.updateDrawn(r1)
            }

        }
    }

    let currentRoute = d1.n == 'root' ? [] : preroutes.concat([d1.n])
    parentLayer.forEach(d => h1(d, currentRoute, depth))
    childrenLayer.forEach(d => h1(d, currentRoute.concat([d.data.n]), d1.n == 'root' ? depth : depth + 1))

    let graph = CalculateConnectivity(currentRoute.length == 0 ? 'root' : currentRoute.join('.'), padding);
    GHT.connectivityGraphs[preroutes.concat([d1.n]).join('.')] = graph;
    if (drawDebugLines) DebugDrawConnectivity(graph, padding)

    //draw links whichever renders last    
    if (!ifBreak)// ifBreak, rects are not rendered
        d1.children.forEach(x => {
            let id = d1.n == 'root' ? x.n : preroutes.concat([d1.n]).concat([x.n]).join('.')
            if (id in links) {
                let dsts = links[id];
                Object.keys(dsts).forEach(d => {
                    let v1 = RootNode.find(d.split('.'))
                    if (!v1) return
                    if (v1.drawn) {
                        let direction = dsts[d]
                        if (direction) DrawLinks(id, d)
                        else DrawLinks(d, id)
                    }
                })
            }
        })
    return ifBreak
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


function createHierarchicalTreemap(node: any, links: any, drawDebugLines = false, preroutes: Array<string>) {
    let currentNodeRoute = node.n == 'root' ? [] : preroutes.concat([node.n])
    node.c.forEach(c => RootNode.addGrandchild(currentNodeRoute, (new HierarchicalNode(c.n, c.v))))
    let currentNode = RootNode.find(currentNodeRoute).createImmediateObject()
    if (!drawTreemap(currentNode, links, drawDebugLines, preroutes)) {
        if (node.n != 'root') preroutes = preroutes.concat(node.n)
        node.c.forEach(w => {
            setTimeout(() => {
                createHierarchicalTreemap(w, links, drawDebugLines, preroutes)
            }, 0)
        })
    }
}