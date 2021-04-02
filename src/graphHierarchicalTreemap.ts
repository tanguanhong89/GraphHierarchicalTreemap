import { Coloring, ConnectivityGraphs, DepthPadding, HierarchicalNode, Links, RootNode, Settings } from './dataStructures'
import * as d3 from 'd3'
import { CalculateConnectivity, DebugDrawConnectivity, DrawLinks } from './connectivity';

export function drawGraphHierarchicalTreemap(hierarchicalNodes: HierarchicalNode, links: number, max: number) {

}

function drawTreemap(d1: any, routes: Array<string>) {
    let ifBreak = false
    let depth = routes.length
    if (d1.children.length == 0) return true
    let oid = "#" + d1["name"];
    oid = oid.replace(/\./g, '\\.')
    let o = $(oid)[0];



    let width = +(o.style.width.replace("px", ""))
    let height = +(o.style.height.replace("px", ""));
    let padding = width / 30 + depth;
    DepthPadding[depth] = padding;
    d1.value = 0;
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
    dataGrp.delete(0);

    let gid = "#g-" + d1["name"];
    gid = gid.replace(/\./g, '\\.')
    let g = $(gid)[0];
    let xoffset = g == undefined ? 0 : +(g.getAttribute('x'));
    let yoffset = g == undefined ? 0 : +(g.getAttribute('y'));

    dataGrp.forEach(x => {
        x.forEach(d => {
            if ((d.x1 - d.x0) < Settings.minPxSize || (d.y1 - d.y0) < Settings.minPxSize) {
                ifBreak = true
            } else {
                let g = d3.select("#base").append('g');
                g.attr("transform", `translate(${xoffset + d.x0},${yoffset + d.y0})`)
                    .attr("x", xoffset + d.x0) //does nothing, for easier ref
                    .attr("y", yoffset + d.y0) //does nothing, for easier ref
                    .attr("class", "p" + d1.name)
                    .attr("id", "g-" + d.data.n);

                let color = d3.scaleSequential([Settings.maxDepth, 0], d3.interpolateBlues);
                if (routes.length == 0) color = Coloring.Rect[d.data.n](d.data.d)
                else if (routes[0] in Coloring.Rect) color = Coloring.Rect[d.data.n](d.data.d)
               
                g.append("rect")
                    .attr("id", d.data.n)
                    .style("fill", color)
                    .style("width", (d.x1 - d.x0) + "px")
                    .style("height", (d.y1 - d.y0) + "px")

                RootNode.updateDrawn(routes.concat([d.data.n]))
            }
        })
    });

    let graph = CalculateConnectivity(d1.name, padding);
    ConnectivityGraphs[d1.name] = graph;
    if (Settings.drawDebugLines) DebugDrawConnectivity(graph, padding)

    //draw links whichever renders last
    d1.children.forEach(x => {
        if (x.n in Links) {
            let dsts = Links[x.n];
            Object.keys(dsts).forEach(d => {
                if (RootNode.find(d.split(',')).drawn) {
                    DrawLinks(x.n, d)
                }
            })
        }
    })
    return ifBreak
}


function createHierarchicalTreemap(node: HierarchicalNode, routes: Array<string>) {
    let rootNodeObj = node.createImmediateMapObject()
    if (routes.length == 0 && !Coloring.Rect && node.children.size > 0) {
        let colorSchemeList = [
            d3.scaleSequential([Settings.maxDepth, 0], d3.interpolateCool),
            d3.scaleSequential([Settings.maxDepth, 0], d3.interpolateSinebow),
            d3.scaleSequential([Settings.maxDepth, 0], d3.interpolateWarm),
            d3.scaleSequential([Settings.maxDepth, 0], d3.interpolateRainbow),
        ]

        let colorMap = new Map<String, any>()
        node.children.forEach(c => {
            colorMap.set(c.name, colorSchemeList[Math.round(Math.random() * (node.children.size - 1))])
        })
        Coloring.Rect = function (n: string) {
            return colorMap[n]
        }
    }
    if (!drawTreemap(rootNodeObj, routes)) {
        routes.push(node.name)
        node.children.forEach(w => {
            setTimeout(() => {
                createHierarchicalTreemap(w, routes)
            }, 0)
        })
    }
}