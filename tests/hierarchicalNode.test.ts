import { HierarchicalNode, RootNode } from '../src/dataStructures'

describe("RootNode", function () {
    let a = new HierarchicalNode('a', 1)
    let b = new HierarchicalNode('b', 1)
    let c = new HierarchicalNode('c', 1)


    let aa = new HierarchicalNode('aa', 1)
    a.addChild(aa)

    let aaa = new HierarchicalNode('aaa', 2)
    aa.addChild(aaa)

    RootNode.addChild(a)
    RootNode.addChild(b)
    RootNode.addChild(c)


    it("should have 3 children", () => {
        expect(RootNode.children.size).toBe(3);
    });

    it("should find a", () => {
        expect(RootNode.find(['a']).name).toBe('a');
    });

    it("should find aaa", () => {
        expect(RootNode.find(['a', 'aa', 'aaa']).name).toBe('aaa');
    });

    it("should have c drawn", () => {
        RootNode.updateDrawn(['c'])
        expect(RootNode.find(['c']).drawn).toBeTruthy();
    });

    it("should have correct map obj", () => {
        let x = RootNode.find(['a']).createImmediateObject()
        let k = Object.keys(x);
        expect(k.includes('children')).toBeTruthy();
        expect(x.children.length).toEqual(1);
        expect(x.children[0].children.length).toEqual(0);
    });

    it("should find aaaa", () => {
        RootNode.addGrandchild(['a', 'aa', 'aaa'], new HierarchicalNode('aaaa', 0))
        expect(RootNode.find(['a', 'aa', 'aaa','aaaa']).name).toBe('aaaa');
    });

});