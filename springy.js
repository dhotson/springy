/**
 * Springy v2.7.1
 *
 * Copyright (c) 2010-2013 Dennis Hotson
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
"use strict";
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(function () {
            return (root.returnExportsGlobal = factory());
        });
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals
        root.Springy = factory();
    }
}(this, function() {
	const boosted = typeof(Float64Array) !== 'undefined' ? 2 : 1; // DS: 0: 2.7fps vs 1: 11.7fps vs 2: 18.4fps
	var Springy = {};

	var Graph = Springy.Graph = function() {
		this.nodeSet = {};
		this.nodes = [];
		this.edges = [];
		this.adjacency = {};

		this.nextNodeId = 0;
		this.nextEdgeId = 0;
		this.eventListeners = [];
	};

	var Node = Springy.Node = function(id, data) {
		this.id = id;
		this.data = (data !== undefined) ? data : {};

	// Data fields used by layout algorithm in this file:
	// this.data.mass
	// this.data.insulator
	// Data used by default renderer in springyui.js
	// this.data.label
	// this.data.color
	// this.inside
	};

	var Edge = Springy.Edge = function(id, source, target, data) {
		this.id = id;
		this.source = source;
		this.target = target;
		this.data = (data !== undefined) ? data : {};

	// Edge data field used by layout alorithm
	// this.data.length
	// this.data.type
	};

	Graph.prototype.addNode = function(node) {
		if (!(node.id in this.nodeSet)) {
			this.nodes.push(node);
		}

		this.nodeSet[node.id] = node;

		this.notify();
		return node;
	};

	Graph.prototype.addNodes = function() {
		// accepts variable number of arguments, where each argument
		// is a string that becomes both node identifier and label
		for (var i = 0; i < arguments.length; i++) {
			var name = arguments[i];
			var node = new Node(name, {label:name});
			this.addNode(node);
		}
	};

	Graph.prototype.addEdge = function(edge) {
		var exists = false;
		this.edges.forEach(function(e) {
			if (edge.id === e.id) { exists = true; }
		});

		if (!exists) {
			this.edges.push(edge);
		}

		if (!(edge.source.id in this.adjacency)) {
			this.adjacency[edge.source.id] = {};
		}
		if (!(edge.target.id in this.adjacency[edge.source.id])) {
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
	};

	Graph.prototype.addEdges = function() {
		// accepts variable number of arguments, where each argument
		// is a triple [nodeid1, nodeid2, attributes]
		for (var i = 0; i < arguments.length; i++) {
			var e = arguments[i];
			var node1 = this.nodeSet[e[0]];
			if (node1 == undefined) {
				throw new TypeError("invalid node name: " + e[0]);
			}
			var node2 = this.nodeSet[e[1]];
			if (node2 == undefined) {
				throw new TypeError("invalid node name: " + e[1]);
			}
			var attr = e[2];

			this.newEdge(node1, node2, attr);
		}
	};

	Graph.prototype.newNode = function(data) {
		var node = new Node(this.nextNodeId++, data);
		this.addNode(node);
		return node;
	};

	Graph.prototype.newEdge = function(source, target, data) {
		var edge = new Edge(this.nextEdgeId++, source, target, data);
		this.addEdge(edge);
		return edge;
	};


	// add nodes and edges from JSON object
	Graph.prototype.loadJSON = function(json) {
	/**
	Springy's simple JSON format for graphs.

	historically, Springy uses separate lists
	of nodes and edges:

		{
			"nodes": [
				"center",
				"left",
				"right",
				"up",
				"satellite"
			],
			"edges": [
				["center", "left"],
				["center", "right"],
				["center", "up"]
			]
		}

	**/
		// parse if a string is passed (EC5+ browsers)
		if (typeof json == 'string' || json instanceof String) {
			json = JSON.parse( json );
		}

		if ('nodes' in json || 'edges' in json) {
			this.addNodes.apply(this, json['nodes']);
			this.addEdges.apply(this, json['edges']);
		}
	}


	// find the edges from node1 to node2
	Graph.prototype.getEdges = function(node1, node2) {
		if (node1.id in this.adjacency
			&& node2.id in this.adjacency[node1.id]) {
			return this.adjacency[node1.id][node2.id];
		}

		return [];
	};

	// remove a node and it's associated edges from the graph
	Graph.prototype.removeNode = function(node) {
		if (node.id in this.nodeSet) {
			delete this.nodeSet[node.id];
		}

		for (var i = this.nodes.length - 1; i >= 0; i--) {
			if (this.nodes[i].id === node.id) {
				this.nodes.splice(i, 1);
			}
		}

		this.detachNode(node);
	};

	// removes edges associated with a given node
	Graph.prototype.detachNode = function(node) {
		var tmpEdges = this.edges.slice();
		tmpEdges.forEach(function(e) {
			if (e.source.id === node.id || e.target.id === node.id) {
				this.removeEdge(e);
			}
		}, this);

		this.notify();
	};

	// remove a node and it's associated edges from the graph
	Graph.prototype.removeEdge = function(edge) {
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

				// Clean up empty edge arrays
				if (this.adjacency[x][y].length == 0) {
					delete this.adjacency[x][y];
				}
			}

			// Clean up empty objects
			if (isEmpty(this.adjacency[x])) {
				delete this.adjacency[x];
			}
		}

		this.notify();
	};

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
	Graph.prototype.merge = function(data) {
		var nodes = [];
		data.nodes.forEach(function(n) {
			nodes.push(this.addNode(new Node(n.id, n.data)));
		}, this);

		data.edges.forEach(function(e) {
			var from = nodes[e.from];
			var to = nodes[e.to];

			var id = (e.directed)
				? (id = e.type + "-" + from.id + "-" + to.id)
				: (from.id < to.id) // normalise id for non-directed edges
					? e.type + "-" + from.id + "-" + to.id
					: e.type + "-" + to.id + "-" + from.id;

			var edge = this.addEdge(new Edge(id, from, to, e.data));
			edge.data.type = e.type;
		}, this);
	};

	Graph.prototype.filterNodes = function(fn) {
		var tmpNodes = this.nodes.slice();
		tmpNodes.forEach(function(n) {
			if (!fn(n)) {
				this.removeNode(n);
			}
		}, this);
	};

	Graph.prototype.filterEdges = function(fn) {
		var tmpEdges = this.edges.slice();
		tmpEdges.forEach(function(e) {
			if (!fn(e)) {
				this.removeEdge(e);
			}
		}, this);
	};


	Graph.prototype.addGraphListener = function(obj) {
		this.eventListeners.push(obj);
	};

	Graph.prototype.notify = function() {
		this.eventListeners.forEach(function(obj){
			obj.graphChanged();
		});
	};

	// -----------
	var Layout = Springy.Layout = {};
	Layout.ForceDirected = function(graph, stiffness, repulsion, damping, minEnergyThreshold, maxSpeed, fontsize, fontname, zoomFactor, pinWeight) {
		this.graph = graph;
		this.stiffness = stiffness; // spring stiffness constant
		this.repulsion = repulsion; // repulsion constant
		this.damping = damping; // velocity damping factor
		this.minEnergyThreshold = minEnergyThreshold || 0.01; //threshold used to determine render stop
		this.maxSpeed = maxSpeed || 100.0; // nodes aren't allowed to exceed this speed
		this.fontsize = fontsize || 8.0;
		this.edgeFontsize = this.fontsize * 9 / 10;
		this.fontname = fontname || "Verdana, sans-serif";
		this.nodeFont = this.fontsize.toString() + 'px ' + this.fontname;
		this.edgeFont = this.edgeFontsize.toString() + 'px ' + this.fontname;
		this.pinWeight = pinWeight || 10;
		this.scaleFactor = 1.025;	// scale factor for each wheel click.
		this.zoomFactor = zoomFactor || 1.0;	// current zoom factor for the whole canvas.
		this.realFontsize = this.fontsize * this.zoomFactor;
		this.realEdgeFontsize = this.edgeFontsize * this.zoomFactor;
		this.selected = null;
		this.exciteMethod = 'none'; // none, downstream, upstream, connected
		this.energy = 0;
		this.nodePoints = {}; // keep track of points associated with nodes
		this.edgeSprings = {}; // keep track of springs associated with edges
		this.times = [];
		this.fps = 0;
	};

	Layout.ForceDirected.prototype.point = function(node) {
		if (!(node.id in this.nodePoints)) {
			var mass = (node.data.mass !== undefined) ? parseFloat(node.data.mass) : 1.0;
			var insulator = (node.data.insulator !== undefined) ? node.data.insulator : false;
			// DS: load positions from user data
			var x = (node.data.x !== undefined) ? parseFloat(node.data.x) : 10.0 * (Math.random() - 0.5);
			var y = (node.data.y !== undefined) ? parseFloat(node.data.y) : 10.0 * (Math.random() - 0.5);
			this.nodePoints[node.id] = new Layout.ForceDirected.Point(new Vector(x, y), mass, insulator);
		}

		return this.nodePoints[node.id];
	};

	Layout.ForceDirected.prototype.spring = function(edge) {
		if (!(edge.id in this.edgeSprings)) {
			var length = (edge.data.length !== undefined) ? edge.data.length : 1.0;

			var existingSpring = false;

			var from = this.graph.getEdges(edge.source, edge.target);
			from.forEach(function(e) {
				if (existingSpring === false && e.id in this.edgeSprings) {
					existingSpring = this.edgeSprings[e.id];
				}
			}, this);

			if (existingSpring !== false) {
				return new Layout.ForceDirected.Spring(existingSpring.point1, existingSpring.point2, 0.0, 0.0);
			}

			var to = this.graph.getEdges(edge.target, edge.source);
			from.forEach(function(e){
				if (existingSpring === false && e.id in this.edgeSprings) {
					existingSpring = this.edgeSprings[e.id];
				}
			}, this);

			if (existingSpring !== false) {
				return new Layout.ForceDirected.Spring(existingSpring.point2, existingSpring.point1, 0.0, 0.0);
			}

			this.edgeSprings[edge.id] = new Layout.ForceDirected.Spring(
				this.point(edge.source), this.point(edge.target), length, this.stiffness
			);
		}

		return this.edgeSprings[edge.id];
	};

	// produce a random sample: callback should accept two arguments: Node, Point
	Layout.ForceDirected.prototype.sampleNode = function(callback, limit) {
		var t = this;
    	var sample = [];
		var length = this.graph.nodes.length;
		var n = Math.max(Math.min(limit, length), 0);
		while (n--) {
		  var rand =  Math.floor(Math.random() * length);
      	  sample[rand] = t.graph.nodes[rand]; // deduplicate
		}
		sample.forEach(function(n){
			callback.call(t, n, t.point(n));
		});
	};

	// callback should accept two arguments: Node, Point
	Layout.ForceDirected.prototype.eachNode = function(callback) {
		var t = this;
		this.graph.nodes.forEach(function(n){
			callback.call(t, n, t.point(n));
		});
	};

	// callback should accept two arguments: Edge, Spring
	Layout.ForceDirected.prototype.eachEdge = function(callback) {
		var t = this;
		this.graph.edges.forEach(function(e){
			callback.call(t, e, t.spring(e));
		});
	};

	// callback should accept one argument: Spring
	Layout.ForceDirected.prototype.eachSpring = function(callback) {
		var t = this;
		this.graph.edges.forEach(function(e){
			callback.call(t, t.spring(e));
		});
	};

	Layout.ForceDirected.prototype.scaleFontSize = function(factor) {
		const t = this;
		let realFontsize = t.fontsize * t.zoomFactor * factor; 
		realFontsize = Math.max(Math.min(realFontsize, 30), 0.5);
		t.realFontsize = realFontsize;
		t.fontsize = realFontsize / t.zoomFactor;
		t.realEdgeFontsize = realFontsize * 9 / 10;
		t.edgeFontsize = t.fontsize * 9 / 10;
		t.nodeFont = t.fontsize.toString() + 'px ' + t.fontname;
		t.edgeFont = t.edgeFontsize.toString() + 'px ' + t.fontname;
	};

	Layout.ForceDirected.prototype.scaleZoomFactor = function(factor) {
		let zoomFactor = this.zoomFactor * factor;
		zoomFactor = Math.max(Math.min(zoomFactor, 12.0), 1.0);
		if (this.zoomFactor !== zoomFactor) {
			this.zoomFactor = zoomFactor;
			return true;
		} else {
			return false;
		}
	};

	Layout.ForceDirected.prototype.setPinWeight = function(weight) {
		this.pinWeight = weight;
	};

	Layout.ForceDirected.prototype.setExciteMethod = function(exciteMethod) {
		this.exciteMethod = exciteMethod;	
	};

	Layout.ForceDirected.prototype.setParameter = function(param) {
		const t = this;
		t.stiffness = param.stiffness || t.stiffness; // spring stiffness constant
		t.repulsion = param.repulsion || t.repulsion; // repulsion constant
		t.damping = param.damping || t.damping; // velocity damping factor
		t.minEnergyThreshold = param.minEnergyThreshold || t.minEnergyThreshold; //threshold used to determine render stop
		t.maxSpeed = param.maxSpeed || t.maxSpeed; // nodes aren't allowed to exceed this speed
		const len = this.graph.edges.length;
		for(let n=0;n<len;n++) {
			this.edgeSprings[n].k = t.stiffness;
		}
	};

	let timeslice = 200000;
	let loops_cnt = timeslice;
	let sliceTimer = null;
	function tic_fork (cnt, stage) {
		loops_cnt -= cnt;
		if (loops_cnt <= 0) {		// DS: with 1,000 nodes we have 1,000,000 iterations, thats why i slice the time.
			loops_cnt = timeslice;
			// console.log('tic'+stage);
			if (! sliceTimer) {
				sliceTimer = window.setTimeout(function (){
					// console.log('tic-slice'+stage);
					sliceTimer = null;
				}, 1);
			}
		}
	}
	// Physics stuff
	Layout.ForceDirected.prototype.applyCoulombsLaw = boosted === 2 ? function() {
		// Boosted method 2 -- hand written assembler code - loops variables are transformed into static memory array addresses
		const len = this.graph.nodes.length;
		let dir = new Float64Array(8); 
		dir[7] = this.repulsion;
		// dir[0]=dir_x; dir[1]=dir_y; dir[2]=distance; dir[3]=force
		// dir[4]=p1.x; dir[5]=p1.y; dir[6]=1/p1.m; dir[7]=repulsion
		for(let n=0;n<len;n++) {
			const point1 = this.nodePoints[n];
			dir[4] = point1.p.x; 
			dir[5] = point1.p.y;
			dir[6] = 1 / point1.m;
			for(let m=n+1;m<len;m++) {
				const point2 = this.nodePoints[m];
				dir[0] = dir[4] - point2.p.x;	// subtract
				dir[1] = dir[5] - point2.p.y;
				dir[2] = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]) + 0.3;	// magnitude
				dir[0] /= dir[2];	// normalise
				dir[1] /= dir[2];
				dir[3] = dir[7] / (dir[2] * dir[2] * 0.5);
				dir[0] *= dir[3];
				dir[1] *= dir[3]; // apply forces
				point1.a.x += dir[0] * dir[6];
				point1.a.y += dir[1] * dir[6];
				point2.a.x -= dir[0] / point2.m;
				point2.a.y -= dir[1] / point2.m;
			};
			tic_fork (len-n, 1);
		};
	} :
	boosted ? function() {
		// Boosted method 1 -- improved math, improved memory usage, inline functions
		const len = this.graph.nodes.length;
		let dir = new Vector(0,0);
		for(let n=0;n<len;n++) {
			const point1 = this.nodePoints[n];
			for(let m=n+1;m<len;m++) {
				const point2 = this.nodePoints[m];
				dir.x = point1.p.x - point2.p.x;	// subtract
				dir.y = point1.p.y - point2.p.y;
				const distance = Math.sqrt(dir.x*dir.x+dir.y*dir.y) + 0.1;	// magnitude
				dir.x /= distance;		// normalise
				dir.y /= distance;
				const force = this.repulsion / (distance * distance * 0.5);
				dir.x *= force;
				dir.y *= force; // apply forces
				point1.a.x += dir.x / point1.m;
				point1.a.y += dir.y / point1.m;
				point2.a.x -= dir.x / point2.m;
				point2.a.y -= dir.y / point2.m;
			};
			tic_fork (len-n, 1);
		};
	} :
	function() {
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
			tic_fork (this.graph.nodes.length, 1);
		});
	};

	Layout.ForceDirected.prototype.applyHookesLaw = boosted ? function() {
		let dir = new Vector(0,0);
		for(let n=0;n<this.graph.edges.length;n++) {
			const spring = this.spring(this.graph.edges[n]);
			dir.x = spring.point2.p.x - spring.point1.p.x;	// subtract
			dir.y = spring.point2.p.y - spring.point1.p.y;
			const distance = Math.sqrt(dir.x*dir.x+dir.y*dir.y);	// magnitude
			let displacement = (spring.length - distance) * spring.k * -0.5;
			dir.x = dir.x / distance || 0;		// normalise
			dir.y = dir.y / distance || 0;		// direction
			dir.x *= displacement;
			dir.y *= displacement;
			spring.point1.a.x += dir.x / spring.point1.m;
			spring.point1.a.y += dir.y / spring.point1.m;
			spring.point2.a.x -= dir.x / spring.point2.m;
			spring.point2.a.y -= dir.y / spring.point2.m;
		};
	} :
	function() {
		this.eachSpring(function(spring){
			var d = spring.point2.p.subtract(spring.point1.p); // the direction of the spring
			var displacement = spring.length - d.magnitude();
			var direction = d.normalise();

			// apply force to each end point
			spring.point1.applyForce(direction.multiply(spring.k * displacement * -0.5));
			spring.point2.applyForce(direction.multiply(spring.k * displacement * 0.5));
		});
	};

	Layout.ForceDirected.prototype.attractToCentre = function() {
		this.eachNode(function(node, point) {
			var direction = point.p.multiply(-1.0);
			point.applyForce(direction.multiply(this.repulsion / 50.0));
		});
	};

	Layout.ForceDirected.prototype.propagateExcitement = function() {
		var t = this;
		let method = t.exciteMethod;
		let cnt = 1;
		
		this.eachNode(function(node, point) {
			point.e = false;
		});
		if (method === 'none') {
			if (t.selected !== null && t.selected.node !== null) {
				t.selected.point.e = true;	// set selected node Excitement
			}
			return;
		}
		let method_fn = method === 'downstream' ? 
			function(spring){
				if (spring.point1.e && ! spring.point2.e && (! spring.point1.i || spring.point1 === t.selected.point)) {
					spring.point2.e = true;
					cnt++;
				}
			} : method === 'upstream' ? 
			function(spring){
				if (spring.point2.e && ! spring.point1.e && (! spring.point2.i || spring.point2 === t.selected.point)) {
					spring.point1.e = true;
					cnt++;
				}
			} : method === 'connected' ? 
			function(spring){
				if (spring.point1.e && ! spring.point2.e) {
					spring.point2.e = true;
					cnt++;
				}
				if (spring.point2.e && ! spring.point1.e) {
					spring.point1.e = true;
					cnt++;
				}
			} : null;
		if (method_fn) {
			if (t.selected !== null && t.selected.node !== null) {
				t.selected.point.e = true;	// set selected node Excitement
			}
			while (cnt) {
				cnt = 0;
				this.eachSpring(method_fn);
			}
		}
	};

	Layout.ForceDirected.prototype.updateVelocity = function(timestep) {
		this.eachNode(function(node, point) {
			// Is this, along with updatePosition below, the only places that your
			// integration code exist?
			point.v = point.v.add(point.a.multiply(timestep)).multiply(this.damping);
			if (point.v.magnitude() > this.maxSpeed) {
			    point.v = point.v.normalise().multiply(this.maxSpeed);
			}
			point.a = new Vector(0,0);
		});
	};

	Layout.ForceDirected.prototype.updatePosition = function(timestep) {
		this.eachNode(function(node, point) {
			// Same question as above; along with updateVelocity, is this all of
			// your integration code?
			point.p = point.p.add(point.v.multiply(timestep));
		});
	};

	// Calculate the total kinetic energy of the system
	Layout.ForceDirected.prototype.totalEnergy = function(timestep) {
		var energy = 0.0;
		this.eachNode(function(node, point) {
			var speed = point.v.magnitude();
			energy += 0.5 * point.m * speed * speed;
		});

		return energy;
	};

	Layout.ForceDirected.prototype.getNodePositions = function() {
		var nodes_array = [];
		this.eachNode(function(node, point) {
			var element = {id:node.data.name, x:point.p.x, y:point.p.y, mass:point.m, active:point.e};
			nodes_array.push(element);
		});
		return nodes_array;
	};

	var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }; // stolen from coffeescript, thanks jashkenas! ;-)

	Springy.requestAnimationFrame = __bind(window.requestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.oRequestAnimationFrame ||
		window.msRequestAnimationFrame ||
		(function(callback, element) {
			window.setTimeout(callback, 10);
		}), window);


	/**
	 * Start simulation if it's not running already.
	 * In case it's running then the call is ignored, and none of the callbacks passed is ever executed.
	 */
	Layout.ForceDirected.prototype.start = function(render, onRenderStop, onRenderStart, do_update) {
		var t = this;

		if (this._started) return;
		this._started = true;
		this._stop = false;

		if (onRenderStart !== undefined) { onRenderStart(); }
		Springy.requestAnimationFrame(function step() {
			const now = performance.now();
			while (t.times.length > 0 && t.times[0] <= now - 10000) {
			  t.times.shift();
			}
			t.times.push(now);
			t.fps = t.times.length / 10;

			if (do_update) {
				t.tick(0.03);
			}
			if (render !== undefined) {
				render();
			}
			// console.log('toc');
			// stop simulation when energy of the system goes below a threshold
			t.energy = t.totalEnergy();
			if (t._stop || t.energy < t.minEnergyThreshold) {
				t._started = false;
				if (onRenderStop !== undefined) { onRenderStop(); }
			} else if (UA.isSafari()) {
				window.setTimeout(function (){
					Springy.requestAnimationFrame(step);
				}, 5);
			} else {
				Springy.requestAnimationFrame(step);
			}
		});
	};

	Layout.ForceDirected.prototype.stop = function() {
		this._stop = true;
	}

	Layout.ForceDirected.prototype.tick = function(timestep) {
		this.applyCoulombsLaw();
		this.applyHookesLaw();
		tic_fork (this.graph.edges.length, 2);
		this.attractToCentre();
		this.updateVelocity(timestep);
		this.updatePosition(timestep);
		tic_fork (this.graph.nodes.length * 3, 3);
	};

	// Find the nearest point to a particular position
	Layout.ForceDirected.prototype.nearest = function(pos) {
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
	};

	Layout.ForceDirected.prototype.findNode = function(node_id) {
		var min = null;
		var pos = new Springy.Vector(0, 0);
		var t = this;
		this.graph.nodes.forEach(function(n){
			var point = t.point(n);
			var distance = point.p.subtract(pos).magnitude();
			if (n.data.name === node_id) {
				min = {node: n, point: point, distance: distance, inside:true};
				return min;
			}
		});

		return min;
	}

	Layout.ForceDirected.prototype.selectNode = function(node_id) {
		var t = this;
		t.selected = t.findNode(node_id);
		return t.selected;
	}

	Layout.ForceDirected.prototype.isSelectedNode = function(node_id) {
		var t = this;
		return (t.selected !== null && t.selected.node !== null 
			&& (t.selected.node.id === node_id || node_id === null)
			&& t.selected.inside);
	}

	Layout.ForceDirected.prototype.isExcitedNode = function(node_id) {
		return this.nodePoints[node_id].e || false;
	}

	Layout.ForceDirected.prototype.isSelectedEdge = function(edge) {
		var t = this;
		return (t.selected !== null && t.selected.node !== null 
			&& (t.selected.node.id === edge.source.id || t.selected.node.id === edge.target.id)
			&& t.selected.inside)
		|| (   t.isExcitedNode(edge.source.id) 
		    && t.isExcitedNode(edge.target.id));
	}
			
	Layout.ForceDirected.prototype.setNodeProperties = function(label, color, shape) {
		var t = this;
		if (t.isSelectedNode(null)) {
			t.selected.node.data.label = label;
			t.selected.node.data.color = color;
			t.selected.node.data.shape = shape;
		}
	}

	// returns [bottomleft, topright]
	Layout.ForceDirected.prototype.getBoundingBox = function() {
		var bottomleft = new Vector(-2,-2);
		var topright = new Vector(2,2);

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

		var padding = topright.subtract(bottomleft).multiply2(0.14, 0.07); // ~5% padding 

		return {bottomleft: bottomleft.subtract(padding), topright: topright.add(padding)};
	};


	// Vector
	var Vector = Springy.Vector = function(x, y) {
		this.x = x;
		this.y = y;
	};

	Vector.random = function() {
		return new Vector(10.0 * (Math.random() - 0.5), 10.0 * (Math.random() - 0.5));
	};

	Vector.prototype.add = function(v2) {
		return new Vector(this.x + v2.x, this.y + v2.y);
	};

	Vector.prototype.subtract = function(v2) {
		return new Vector(this.x - v2.x, this.y - v2.y);
	};

	Vector.prototype.multiply = function(n) {
		return new Vector(this.x * n, this.y * n);
	};

	Vector.prototype.multiply2 = function(n, m) {
		return new Vector(this.x * n, this.y * m);
	};

	Vector.prototype.divide = function(n) {
		return new Vector((this.x / n) || 0, (this.y / n) || 0); // Avoid divide by zero errors..
	};

	Vector.prototype.magnitude = function() {
		return Math.sqrt(this.x*this.x + this.y*this.y);
	};

	Vector.prototype.normal = function() {
		return new Vector(-this.y, this.x);
	};

	Vector.prototype.normalise = function() {
		return this.divide(this.magnitude());
	};

	// Point
	Layout.ForceDirected.Point = function(position, mass, insulator) {
		this.p = position; // position
		this.m = mass; // mass
		this.i = insulator; // insulator
		this.e = false; // excited
		this.v = new Vector(0, 0); // velocity
		this.a = new Vector(0, 0); // acceleration
	};

	Layout.ForceDirected.Point.prototype.applyForce = function(force) {
		this.a = this.a.add(force.divide(this.m));
	};

	// Spring
	Layout.ForceDirected.Spring = function(point1, point2, length, k) {
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

	/**
	 * Renderer handles the layout rendering loop
	 * @param onRenderStop optional callback function that gets executed whenever rendering stops.
	 * @param onRenderStart optional callback function that gets executed whenever rendering starts.
	 * @param onRenderFrame optional callback function that gets executed after each frame is rendered.
	 */
	var Renderer = Springy.Renderer = function(layout, clear, drawEdge, drawNode, getCanvasPos, onRenderStop, onRenderStart, onRenderFrame, zoomCanvas) {
		this.layout = layout;
		this.clear = clear;
		this.drawEdge = drawEdge;
		this.drawNode = drawNode;
		this.getCanvasPos = getCanvasPos;
		this.onRenderStop = onRenderStop;
		this.onRenderStart = onRenderStart;
		this.onRenderFrame = onRenderFrame;
		this.zoomCanvas = zoomCanvas;
		this.layout.graph.addGraphListener(this);
	}

	Renderer.prototype.graphChanged = function(e) {
		this.start(true);
	};

	Renderer.prototype.propagateExcitement = function(method) {
		this.propagateExcitement(method);
	};

	Renderer.prototype.selectNode = function(name) {
		this.layout.selectNode(name);
		this.layout.propagateExcitement();
		this.start(true);
	};

	Renderer.prototype.getNodePositions = function(e) {
		return JSON.stringify(this.layout.getNodePositions());
	};

	Renderer.prototype.getCanvasPos = function(e) {
		return this.getCanvasPos();
	};

	Renderer.prototype.scaleFontSize = function(factor) {
		this.layout.scaleFontSize(factor);
		this.start(true);
	};

	Renderer.prototype.scaleZoomFactor = function(factor) {
		var t = this;
		if (t.layout.scaleZoomFactor(factor)) {
			t.layout.scaleFontSize(1.0);
			if (t.zoomCanvas !== undefined) { t.zoomCanvas(factor); }
			t.start(true);
		}
	};

	Renderer.prototype.setPinWeight = function(weight) {
		this.layout.setPinWeight(weight);
	};

	Renderer.prototype.setExciteMethod = function(exciteMethod) {
		this.layout.setExciteMethod(exciteMethod);	// none, downstream, upstream, connected
		this.layout.propagateExcitement();
		this.start(true);
	};

	Renderer.prototype.setParameter = function(param) {
		this.layout.setParameter(param);	
		this.start(true);
	};

	Renderer.prototype.setNodeProperties = function(label, color, shape) {
		this.layout.setNodeProperties(label, color, shape);
		this.start(true);
	};

	/**
	 * Starts the simulation of the layout in use.
	 *
	 * Note that in case the algorithm is still or already running then the layout that's in use
	 * might silently ignore the call, and your optional <code>done</code> callback is never executed.
	 * At least the built-in ForceDirected layout behaves in this way.
	 *
	 * @param done An optional callback function that gets executed when the springy algorithm stops,
	 * either because it ended or because stop() was called.
	 */
	Renderer.prototype.start = boosted ? function(do_update) {
		var t = this;
		this.layout.start(function render() {
			t.clear();
			for(let n=0;n<t.layout.graph.edges.length;n++) {
				let spring = t.layout.spring(t.layout.graph.edges[n]);
				t.drawEdge(t.layout.graph.edges[n], spring.point1.p, spring.point2.p);
			}
			tic_fork (t.layout.graph.edges.length*100, 4);
			for(let n=0;n<t.layout.graph.nodes.length;n++) {
				let point = t.layout.point(t.layout.graph.nodes[n]);
				t.drawNode(t.layout.graph.nodes[n], point.p);
			}
			tic_fork (t.layout.graph.nodes.length*100, 5);
			
			if (t.onRenderFrame !== undefined) { t.onRenderFrame(); }
		}, this.onRenderStop, this.onRenderStart, do_update);
	} :
	function(do_update) {
		var t = this;
		this.layout.start(function render() {
			t.clear();

			t.layout.eachEdge(function(edge, spring) {
				t.drawEdge(edge, spring.point1.p, spring.point2.p);
			});
			tic_fork (t.layout.graph.edges.length*100, 4);

			t.layout.eachNode(function(node, point) {
				t.drawNode(node, point.p);
			});
			tic_fork (t.layout.graph.nodes.length*100, 5);
			
			if (t.onRenderFrame !== undefined) { t.onRenderFrame(); }
		}, this.onRenderStop, this.onRenderStart, do_update);
	};

	Renderer.prototype.stop = function() {
		this.layout.stop();
	};

	// Array.forEach implementation for IE support..
	//https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/forEach
	if ( !Array.prototype.forEach ) {
		Array.prototype.forEach = function( callback, thisArg ) {
			var T, k;
			if ( this == null ) {
				throw new TypeError( " this is null or not defined" );
			}
			var O = Object(this);
			var len = O.length >>> 0; // Hack to convert O.length to a UInt32
			if ( {}.toString.call(callback) != "[object Function]" ) {
				throw new TypeError( callback + " is not a function" );
			}
			if ( thisArg ) {
				T = thisArg;
			}
			k = 0;
			while( k < len ) {
				var kValue;
				if ( k in O ) {
					kValue = O[ k ];
					callback.call( T, kValue, k, O );
				}
				k++;
			}
		};
	}

	var isEmpty = function(obj) {
		for (var k in obj) {
			if (obj.hasOwnProperty(k)) {
				return false;
			}
		}
		return true;
	};

  return Springy;
}));
