# Graph Hierarchical Treemap
A simple framework for visualizing hierarchical data with interconnected relationships.


# 1. Demos
## 1.1. Small Monochromatic (~30 rects)
![alt text](https://github.com/PhantomV1989/GraphHierarchicalTreemap/raw/master/demos/img/smallMonochromatic_36.jpg)https://codepen.io/PhantomV1989/pen/MWJvbrO

## 1.2. Large Monochromatic(~14k rects)
![alt text](https://github.com/PhantomV1989/GraphHierarchicalTreemap/raw/master/demos/img/largeMonochromatic_13941.jpg)https://codepen.io/PhantomV1989/pen/NWdvbMd

## 1.3. Larger Polychromatic(~70k rects)
![alt text](https://github.com/PhantomV1989/GraphHierarchicalTreemap/raw/master/demos/img/largePolychromatic_74938.jpg)https://codepen.io/PhantomV1989/pen/abpyBRP

## 1.4. Larger Polychromatic Pan Zoom(~80k rects)
![alt text](https://github.com/PhantomV1989/GraphHierarchicalTreemap/raw/master/demos/img/largePolychromaticPanZoom_84937.jpg)https://codepen.io/PhantomV1989/pen/rNjzWEq
#### 1.4.1. Zoom Area 1
![alt text](https://github.com/PhantomV1989/GraphHierarchicalTreemap/raw/master/demos/img/zoomArea1.jpg)
#### 1.4.2. Zoom Area 2
![alt text](https://github.com/PhantomV1989/GraphHierarchicalTreemap/raw/master/demos/img/zoomArea2.jpg)
## 1.5. Large Mosaic Pan Zoom(~40k rects)
![alt text](https://github.com/PhantomV1989/GraphHierarchicalTreemap/raw/master/demos/img/largeMosaicPanZoom_45810.jpg)https://codepen.io/PhantomV1989/pen/jOyLyOZ


# 2. How to use

## 2.1. Minimal example
Refer to 
https://raw.githubusercontent.com/PhantomV1989/GraphHierarchicalTreemap/master/demos/minimalExample.html

## 2.2. Dependencies
Load the following dependencies before loading this script
- d3.v6.min.js
- jquery-3.5.1.slim.min.js
eg
```js
<script  src="https://d3js.org/d3.v6.min.js"></script>
<script  src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
```
### Optional
You may want to setup svg-pan-zoom for a better navigation experience.
https://github.com/luncheon/svg-pan-zoom-container
```js
<script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom-container@0.5.0"></script>
```
## 2.3. Function signature
The rendering function **drawGraphHierarchicalTreemap** has 4 arguments, of which 2, both being color functions, are optional.
```js
drawGraphHierarchicalTreemap(
	nodes,
	links,
	rectColoring, // optional
	lineColoring // optional
);
```
Refer to https://raw.githubusercontent.com/PhantomV1989/GraphHierarchicalTreemap/master/demos/minimalExample.html for a running example.
### 2.3.1. nodes
Each node has 3 parameters: **n**(name), **v**(value), **c**(children).
Root node **MUST** always be named **"root"**.
**v** is used by d3's treemap for calculating the node's relative rectangle size.

```js
let data = {
    n: "root", // always starts with root node
    v: 1, // just set as 1, needed because of d3's sizing algo
    c: [
      {
        n: "a", // child a
        v: 1,
        c: [{ n: "qwe", v: 1, c: [] }],
      },
      {
        n: "b", //child b
        v: 1,
        c: [
          { n: "ba", v: 1, c: [] },
          { n: "asd", v: 1, c: [] },
          { n: "qwe", v: 1, c: [] },
        ],
      },
    ],
};
```
### 2.3.2. links
Links contain directional information of the node data.
Node addressing is done by using period **.** to indicate parent-child relationship.

Using example above, we have node **a**, with child node **qwe**. The address of this child node from root would be **a.qwe**.


```js
let  links = { // 1 source, a.qwe to 2 destinations b.ba and b.bc
	"a.qwe":  new  Set(["b.ba", "b.bc"]),
};
```

Links contain source addresses as keys and a set containing their destination addresses as value. So for the below example, we have links
**a.qwe ->b.ba**,
**a.qwe -> b.bc**

 Source & destination can be of hierarchical different levels. Eg.
> **a.a.a.a -> b.b**
> 
### 2.3.3. rectColoring(optional)
rectColoring defines how rectangles should be colored according to their first ancestor name. 

For example, a **'a.b.4.6.2.v'** rectangle, would have first ancestor **'a'**, hence interpolateBlues is used. 
**'a.b.4.6.2.v'** is 5 levels(from 0), hence the color for the rectangle would be **d3.scaleSequential([GraphHierarchicalTreemap.maxDepth, 0], d3.interpolateBlues)(5)**

**maxDepth** is set to 10.
```js
let rectColoring = (firstAncestorName) => {
    // ref https://github.com/d3/d3-scale-chromatic/blob/master/README.md
    let colors = {
        'a': d3.scaleSequential([GraphHierarchicalTreemap.maxDepth, 0], d3.interpolateBlues),
        'b': d3.scaleSequential([GraphHierarchicalTreemap.maxDepth, 0], d3.interpolateReds),
    };
    return colors[firstAncestorName]
}
```

### 2.3.4. lineColoring(optional)
You can also define coloring function for lines to depict different colors at different layers
```js
let  lineColoring = d3.scaleSequential([GraphHierarchicalTreemap.maxDepth, 0], d3.interpolateCool)
```
## 2.4. Notes
- Currently drawing up to a minimum length of 10 pixels for either side for rectangles
- Maximum depth drawn is 10.