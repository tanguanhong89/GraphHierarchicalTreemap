import { HierarchicalNode, RootNode, NodeLookup, GraphHierarchicalTreemap as GHT } from './dataStructures'
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
            let dsts = links[src].values()
            while (1) {
                let dd = dsts.next();
                if (dd.done) break;
                let dst = dd.value;
                if (!(dst in biDirLinks)) biDirLinks[dst] = new Map<string, boolean>()
                biDirLinks[src][dst] = true
                biDirLinks[dst][src] = false
            }
        })
        links = biDirLinks
    }
    createHierarchicalTreemap(node, links, drawDebugLines, preroutes)
}


function drawTreemap(d1: any, links: Map<string, Set<string>>, drawDebugLines: boolean, preroutes: Array<string>) {
    let drawnAny = false
    let depth = preroutes.length;
    if (d1.children.length == 0) return true
    let id = d1.n
    let oid = "#" + id;
    let o = $(oid)[0];
    if (o == undefined) return drawnAny

    let width = +(o.style.width.replace("px", ""))
    let height = +(o.style.height.replace("px", ""));
    let padding = width / 30 + depth;
    if (!(depth in GHT.depthPadding)) GHT.depthPadding[depth] = padding;
    else {
        let newPadding = GHT.depthPadding[depth] * 4 / 5 + padding * 1 / 5;
        GHT.depthPadding[depth] = depth > 0 ?
            Math.min(GHT.depthPadding[depth - 1] * 7 / 8, newPadding) : newPadding
    }
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

    function h1(d, dep, p) {
        if ((d.x1 - d.x0) < GHT.minPxSize || (d.y1 - d.y0) < GHT.minPxSize) {
        } else {
            drawnAny = true
            if (NodeLookup[d.data.n] == undefined) {
                let depthClass = "depth" + dep;
                let gclass = d3.select('.' + depthClass).size() > 0 ? d3.select('.' + depthClass) : d3.select("#root").append('g')
                    .attr("class", depthClass)
                let g = gclass.append('g');
                let pclass = "p-" + (p != undefined ? p : "");
                g.attr("transform", `translate(${xoffset + d.x0},${yoffset + d.y0})`)
                    .attr("x", xoffset + d.x0) //does nothing, for easier ref
                    .attr("y", yoffset + d.y0) //does nothing, for easier ref
                    .attr("class", pclass)
                    .attr("id", "g-" + d.data.n);
                let rect = g.append("rect")
                    .attr("id", d.data.n)
                    .style("width", (d.x1 - d.x0) + "px")
                    .style("height", (d.y1 - d.y0) + "px");
                if (d.data.n != 'root') {
                    rect.style("fill", GHT.coloring.rect(preroutes.length > 1 ? preroutes[1] : d.data.n)(dep));
                    RootNode.addGrandchild(preroutes, (new HierarchicalNode(d.data.n, d.data.v)));
                }
            }

        }
    }

    parentLayer.forEach(d => h1(d, depth, preroutes[preroutes.length - 1]))
    preroutes = preroutes.concat([d1.n])
    childrenLayer.forEach(d => h1(d, depth + 1, d1.n))

    let graph = CalculateConnectivity(d1.n, padding);
    GHT.connectivityGraphs[d1.n] = graph;
    if (drawDebugLines) DebugDrawConnectivity(graph, padding)

    //draw links whichever renders last    
    if (drawnAny)// drawnAny, if any rects are drawn at all
        d1.children.forEach(x => {
            if (x.n in links) {
                let dsts = links[x.n];
                Object.keys(dsts).forEach(d => {
                    if (NodeLookup[d] != undefined) {
                        let direction = dsts[d]
                        if (direction) DrawLinks(x.n, d)
                        else DrawLinks(d, x.n)
                    }
                })
            }
        })
    return drawnAny
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
    if ('c' in node) {
        let currentNode = {
            n: node.n, v: node.v, children: []
        }
        node.c.forEach(c => {
            currentNode.children.push({ n: c.n, v: c.v, children: [] })
        })
        if (drawTreemap(currentNode, links, drawDebugLines, preroutes)) {
            preroutes = preroutes.concat(node.n)
            node.c.forEach(w => {
                setTimeout(() => {
                    createHierarchicalTreemap(w, links, drawDebugLines, preroutes)
                }, 0)
            })
        }
    }
}