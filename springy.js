/**
 * Springy v1.0.1
 *
 * Copyright (c) 2010 Dennis Hotson
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
 
 /* Sreejesh Karunakaran
    Updated to wrap under the namespace Srpingy
    
 */
 
(function(Springy){
    /* 
        The Graph Class
    */
    Springy.Graph = function() {
        this.nodeSet = {};
        this.nodes = [];
        this.edges = [];
        this.adjacency = {};

        this.nextNodeId = 0;
        this.nextEdgeId = 0;
        this.eventListeners = [];
    };
  
    Springy.Graph.prototype = {
        addNode: function(node) {
            if (typeof(this.nodeSet[node.id]) === 'undefined') {
                this.nodes.push(node);
            }

            this.nodeSet[node.id] = node;

            this.notify();
            return node;
        },
        addEdge: function(edge) {
            var exists = false;
            this.edges.forEach(function(e) {
                if (edge.id === e.id) { exists = true; }
            });

            if (!exists) {
                this.edges.push(edge);
            }

            if (typeof(this.adjacency[edge.source.id]) === 'undefined') {
                this.adjacency[edge.source.id] = {};
            }
            if (typeof(this.adjacency[edge.source.id][edge.target.id]) === 'undefined') {
                this.adjacency[edge.source.id][edge.target.id] = [];
            }

            exists = false;
            this.adjacency[edge.source.id][edge.target.id].forEach(function(e) {
                    if (edge.id === e.id) { exists = true; }
            });

            if (!exists) {
                this.adjacency[edge.source.id][edge.target.id].push(edge);
            }

            this.notify();
            return edge;
        },
        newNode: function(data) {
            var node = new Springy.Node(this.nextNodeId++, data);
            this.addNode(node);
            return node;
        },
        newEdge: function(source, target, data) {
            var edge = new Springy.Edge(this.nextEdgeId++, source, target, data);
            this.addEdge(edge);
            return edge;
        },
        // find the edges from node1 to node2
        getEdges: function(node1, node2) {
            if (typeof(this.adjacency[node1.id]) !== 'undefined'
                && typeof(this.adjacency[node1.id][node2.id]) !== 'undefined') {
                return this.adjacency[node1.id][node2.id];
            }

            return [];
        },
        // remove a node and it's associated edges from the graph
        removeNode : function(node) {
            if (typeof(this.nodeSet[node.id]) !== 'undefined') {
                delete this.nodeSet[node.id];
            }

            for (var i = this.nodes.length - 1; i >= 0; i--) {
                if (this.nodes[i].id === node.id) {
                    this.nodes.splice(i, 1);
                }
            }

            this.detachNode(node);

        },
        // removes edges associated with a given node
        detachNode : function(node) {
            var tmpEdges = this.edges.slice();
            tmpEdges.forEach(function(e) {
                if (e.source.id === node.id || e.target.id === node.id) {
                    this.removeEdge(e);
                }
            }, this);

            this.notify();
        },
        removeEdge : function(edge) {
            for (var i = this.edges.length - 1; i >= 0; i--) {
                if (this.edges[i].id === edge.id) {
                    this.edges.splice(i, 1);
                }
            }

            for (var x in this.adjacency) {
                for (var y in this.adjacency[x]) {
                    var edges = this.adjacency[x][y];

                    for (var j=edges.length - 1; j>=0; j--) {
                        if (this.adjacency[x][y][j].id === edge.id) {
                            this.adjacency[x][y].splice(j, 1);
                        }
                    }
                }
            }

            this.notify();
        },
            
        /* Merge a list of nodes and edges into the current graph. eg.
        var o = {
            nodes: [
                {id: 123, data: {type: 'user', userid: 123, displayname: 'aaa'}},
                {id: 234, data: {type: 'user', userid: 234, displayname: 'bbb'}}
            ],
            edges: [
                {from: 0, to: 1, type: 'submitted_design', directed: true, data: {weight: }}
            ]
        }
        */
        merge: function(data) {
            var nodes = [];
            data.nodes.forEach(function(n) {
                nodes.push(this.addNode(new Springy.Node(n.id, n.data)));
            }, this);

            data.edges.forEach(function(e) {
                var from = nodes[e.from];
                var to = nodes[e.to];

                var id = (e.directed)
                    ? (id = e.type + "-" + from.id + "-" + to.id)
                    : (from.id < to.id) // normalise id for non-directed edges
                        ? e.type + "-" + from.id + "-" + to.id
                        : e.type + "-" + to.id + "-" + from.id;

                var edge = this.addEdge(new Springy.Edge(id, from, to, e.data));
                edge.data.type = e.type;
            }, this);
        },
        filterNodes: function(fn) {
        var tmpNodes = this.nodes.slice();
            tmpNodes.forEach(function(n) {
                if (!fn(n)) {
                    this.removeNode(n);
                }
            }, this);
        },
        
        filterEdges :function(fn) {
            var tmpEdges = this.edges.slice();
            tmpEdges.forEach(function(e) {
                if (!fn(e)) {
                    this.removeEdge(e);
                }
            }, this);
        },
        addGraphListener: function(obj) {
            this.eventListeners.push(obj);
        },
        notify: function() {
            this.eventListeners.forEach(function(obj){
                obj.graphChanged();
            });
        }

    };

    Springy.Node = function(id, data) {
        this.id = id;
        this.data = typeof(data) !== 'undefined' ? data : {};
    };

    Springy.Edge = function(id, source, target, data) {
        this.id = id;
        this.source = source;
        this.target = target;
        this.data = typeof(data) !== 'undefined' ? data : {};
    };




    // ----------- Layout
    Springy.Layout = {};

    var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }; // stolen from coffeescript, thanks jashkenas! ;-)

    Springy.Layout.requestAnimationFrame = __bind(window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function(callback, element) {
            window.setTimeout(callback, 10);
        }, window);

        
        
    Springy.Layout.ForceDirected = function(graph, stiffness, repulsion, damping) {
        this.graph = graph;
        this.stiffness = stiffness; // spring stiffness constant
        this.repulsion = repulsion; // repulsion constant
        this.damping = damping; // velocity damping factor

        this.nodePoints = {}; // keep track of points associated with nodes
        this.edgeSprings = {}; // keep track of springs associated with edges
    };

    // Spring
    Springy.Layout.ForceDirected.Spring = function(point1, point2, length, k) {
        this.point1 = point1;
        this.point2 = point2;
        this.length = length; // spring length at rest
        this.k = k; // spring constant (See Hooke's law) .. how stiff the spring is
    };

    // Layout.ForceDirected.Spring.prototype.distanceToPoint = function(point)
    // {
    // 	// hardcore vector arithmetic.. ohh yeah!
    // 	// .. see http://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment/865080#865080
    // 	var n = this.point2.p.subtract(this.point1.p).normalise().normal();
    // 	var ac = point.p.subtract(this.point1.p);
    // 	return Math.abs(ac.x * n.x + ac.y * n.y);
    // };

    Springy.Layout.ForceDirected.prototype = {
        point : function(node) {
            if (typeof(this.nodePoints[node.id]) === 'undefined') {
                var mass = typeof(node.data.mass) !== 'undefined' ? node.data.mass : 1.0;
                this.nodePoints[node.id] = new Springy.Layout.ForceDirected.Point(Springy.Vector.random(), mass);
            }

            return this.nodePoints[node.id];
        },
        spring: function(edge) {
            if (typeof(this.edgeSprings[edge.id]) === 'undefined') {
                var length = typeof(edge.data.length) !== 'undefined' ? edge.data.length : 1.0;

                var existingSpring = false;

                var from = this.graph.getEdges(edge.source, edge.target);
                from.forEach(function(e) {
                    if (existingSpring === false && typeof(this.edgeSprings[e.id]) !== 'undefined') {
                        existingSpring = this.edgeSprings[e.id];
                    }
                }, this);

                if (existingSpring !== false) {
                    return new Springy.Layout.ForceDirected.Spring(existingSpring.point1, existingSpring.point2, 0.0, 0.0);
                }

                var to = this.graph.getEdges(edge.target, edge.source);
                from.forEach(function(e){
                    if (existingSpring === false && typeof(this.edgeSprings[e.id]) !== 'undefined') {
                        existingSpring = this.edgeSprings[e.id];
                    }
                }, this);

                if (existingSpring !== false) {
                    return new Springy.Layout.ForceDirected.Spring(existingSpring.point2, existingSpring.point1, 0.0, 0.0);
                }

                this.edgeSprings[edge.id] = new Springy.Layout.ForceDirected.Spring(
                    this.point(edge.source), this.point(edge.target), length, this.stiffness
                );
            }

            return this.edgeSprings[edge.id];
        },
        // callback should accept two arguments: Node, Point
        eachNode: function(callback) {
            var t = this;
            this.graph.nodes.forEach(function(n){
                callback.call(t, n, t.point(n));
            });
        },
        eachEdge: function(callback) {
            var t = this;
            this.graph.edges.forEach(function(e){
                callback.call(t, e, t.spring(e));
            });
        },
        eachSpring: function(callback) {
            var t = this;
            this.graph.edges.forEach(function(e){
                callback.call(t, t.spring(e));
            });
        },
        applyCoulombsLaw : function() {
            this.eachNode(function(n1, point1) {
                this.eachNode(function(n2, point2) {
                    if (point1 !== point2)
                    {
                        var d = point1.p.subtract(point2.p);
                        var distance = d.magnitude() + 0.1; // avoid massive forces at small distances (and divide by zero)
                        var direction = d.normalise();

                        // apply force to each end point
                        point1.applyForce(direction.multiply(this.repulsion).divide(distance * distance * 0.5));
                        point2.applyForce(direction.multiply(this.repulsion).divide(distance * distance * -0.5));
                    }
                });
            });
        },
        applyHookesLaw: function() {
            this.eachSpring(function(spring){
                var d = spring.point2.p.subtract(spring.point1.p); // the direction of the spring
                var displacement = spring.length - d.magnitude();
                var direction = d.normalise();

                // apply force to each end point
                spring.point1.applyForce(direction.multiply(spring.k * displacement * -0.5));
                spring.point2.applyForce(direction.multiply(spring.k * displacement * 0.5));
            });
        },
        attractToCentre : function() {
            this.eachNode(function(node, point) {
                var direction = point.p.multiply(-1.0);
                point.applyForce(direction.multiply(this.repulsion / 50.0));
            });
        },
        updateVelocity : function(timestep) {
            this.eachNode(function(node, point) {
                // Is this, along with updatePosition below, the only places that your
                // integration code exist?
                point.v = point.v.add(point.a.multiply(timestep)).multiply(this.damping);
                point.a = new Springy.Vector(0,0);
            });
        },
        updatePosition: function(timestep) {
            this.eachNode(function(node, point) {
                // Same question as above; along with updateVelocity, is this all of
                // your integration code?
                point.p = point.p.add(point.v.multiply(timestep));
            });
        },
        totalEnergy: function(timestep) {
            var energy = 0.0;
            this.eachNode(function(node, point) {
                var speed = point.v.magnitude();
                energy += 0.5 * point.m * speed * speed;
            });

            return energy;
        },
        start : function(interval, render, done) {
            var t = this;

            if (this._started) return;
            this._started = true;

            Springy.Layout.requestAnimationFrame(function step() {
                t.applyCoulombsLaw();
                t.applyHookesLaw();
                t.attractToCentre();
                t.updateVelocity(0.03);
                t.updatePosition(0.03);

                if (typeof(render) !== 'undefined')
                    render();

                // stop simulation when energy of the system goes below a threshold
                if (t.totalEnergy() < 0.01) {
                    t._started = false;
                    if (typeof(done) !== 'undefined') { done(); }
                } else {
                    Springy.Layout.requestAnimationFrame(step);
                }
            });
        },
        nearest: function(pos) {
            var min = {node: null, point: null, distance: null};
            var t = this;
            this.graph.nodes.forEach(function(n){
                var point = t.point(n);
                var distance = point.p.subtract(pos).magnitude();

                if (min.distance === null || distance < min.distance) {
                    min = {node: n, point: point, distance: distance};
                }
            });

            return min;
        },
        getBoundingBox: function() {
            var bottomleft = new Springy.Vector(-2,-2);
            var topright = new Springy.Vector(2,2);

            this.eachNode(function(n, point) {
                if (point.p.x < bottomleft.x) {
                    bottomleft.x = point.p.x;
                }
                if (point.p.y < bottomleft.y) {
                    bottomleft.y = point.p.y;
                }
                if (point.p.x > topright.x) {
                    topright.x = point.p.x;
                }
                if (point.p.y > topright.y) {
                    topright.y = point.p.y;
                }
            });

            var padding = topright.subtract(bottomleft).multiply(0.07); // ~5% padding

            return {bottomleft: bottomleft.subtract(padding), topright: topright.add(padding)};
        }
    }

    // Point
    Springy.Layout.ForceDirected.Point = function(position, mass) {
        this.p = position; // position
        this.m = mass; // mass
        this.v = new Springy.Vector(0, 0); // velocity
        this.a = new Springy.Vector(0, 0); // acceleration
    };

    Springy.Layout.ForceDirected.Point.prototype.applyForce = function(force) {
        this.a = this.a.add(force.divide(this.m));
    };


    // Vector
    Springy.Vector = function(x, y) {
        this.x = x;
        this.y = y;
    };

    Springy.Vector.random = function() {
        return new Springy.Vector(10.0 * (Math.random() - 0.5), 10.0 * (Math.random() - 0.5));
    };

    Springy.Vector.prototype = {
        add: function(v2) {
            return new Springy.Vector(this.x + v2.x, this.y + v2.y);
        },
        subtract: function(v2) {
            return new Springy.Vector(this.x - v2.x, this.y - v2.y);
        },
        multiply: function(n) {
            return new Springy.Vector(this.x * n, this.y * n);
        },
        divide: function(n) {
            return new Springy.Vector((this.x / n) || 0, (this.y / n) || 0); // Avoid divide by zero errors..
        },
        magnitude: function() {
            return Math.sqrt(this.x*this.x + this.y*this.y);
        },
        normal: function() {
            return new Springy.Vector(-this.y, this.x);
        },
        normalise: function() {
            return this.divide(this.magnitude());   
        }
    }




    // Renderer handles the layout rendering loop

    Springy.Renderer = function Renderer(interval, layout, clear, drawEdge, drawNode) {
        this.interval = interval;
        this.layout = layout;
        this.clear = clear;
        this.drawEdge = drawEdge;
        this.drawNode = drawNode;

        this.layout.graph.addGraphListener(this);
    }


    Springy.Renderer.prototype = {
        start: function() {
            var t = this;
            this.layout.start(50, function render() {
                t.clear();

                t.layout.eachEdge(function(edge, spring) {
                    t.drawEdge(edge, spring.point1.p, spring.point2.p);
                });

                t.layout.eachNode(function(node, point) {
                    t.drawNode(node, point.p);
                });
            });
        },
        graphChanged: function(e) {
            this.start();
        }
    };
    //expose Springy
    window.Springy = Springy;
})(window.Springy || {});