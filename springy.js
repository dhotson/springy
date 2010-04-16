
var Graph = function()
{
	this.nodeSet = {};
	this.nodes = [];
	this.edges = [];

	this.eventListeners = [];
};

Node = function(data)
{
	this.id = (Node.nextId += 1);
	this.data = typeof(data) !== 'undefined' ? data : {};
};
Node.nextId = 0;

Edge = function(source, target, data)
{
	this.id = (Edge.nextId += 1);
	this.source = source;
	this.target = target;
	this.data = typeof(data) !== 'undefined' ? data : {};
};
Edge.nextId = 0;

Graph.prototype.addNode = function(node)
{
	this.nodes.push(node);
	this.nodeSet[node.id] = node;
	this.notify();
	return node;
};

Graph.prototype.addEdge = function(edge)
{
	this.edges.push(edge);
	this.notify();
	return edge;
};

Graph.prototype.newNode = function(data)
{
	var node = new Node(data);
	this.addNode(node);
	return node;
};

Graph.prototype.newEdge = function(source, target, data)
{
	var edge = new Edge(source, target, data);
	this.addEdge(edge);
	return edge;
};


Graph.prototype.addGraphListener = function(obj)
{
	this.eventListeners.push(obj);
};

Graph.prototype.notify = function()
{
	this.eventListeners.forEach(function(obj){
		obj.graphChanged();
	});
};

// -----------
var Layout = {};
Layout.ForceDirected = function(graph, stiffness, repulsion, damping)
{
	this.graph = graph;
	this.stiffness = stiffness; // spring stiffness constant
	this.repulsion = repulsion; // repulsion constant
	this.damping = damping; // velocity damping factor

	this.nodePoints = {}; // keep track of points associated with nodes
	this.edgeSprings = {}; // keep track of points associated with nodes
	this.extraSprings = []; // springs that aren't associated with any edges

	this.intervalId = null;
};

Layout.ForceDirected.prototype.point = function(node)
{
	if (typeof(this.nodePoints[node.id]) === 'undefined')
	{
		var mass = typeof(node.data.mass) !== 'undefined' ? node.data.mass : 1.0;
		this.nodePoints[node.id] = new Layout.ForceDirected.Point(Layout.ForceDirected.Vector.random(), mass);
	}

	return this.nodePoints[node.id];
};

Layout.ForceDirected.prototype.spring = function(edge)
{
	if (typeof(this.edgeSprings[edge.id]) === 'undefined')
	{
		var length = typeof(edge.data.length) !== 'undefined' ? edge.data.length : 1.0;
		this.edgeSprings[edge.id] = new Layout.ForceDirected.Spring(
			this.point(edge.source), this.point(edge.target), length, this.stiffness
		);
	}

	return this.edgeSprings[edge.id];
};

// callback should accept two arguments: Node, Point
Layout.ForceDirected.prototype.eachNode = function(callback)
{
	var t = this;
	this.graph.nodes.forEach(function(n){
		callback.call(t, n, t.point(n));
	});
};

// callback should accept two arguments: Edge, Spring
Layout.ForceDirected.prototype.eachEdge = function(callback)
{
	var t = this;
	this.graph.edges.forEach(function(e){
		callback.call(t, e, t.spring(e));
	});
};

// callback should accept one argument: Spring
Layout.ForceDirected.prototype.eachSpring = function(callback)
{
	var t = this;
	this.graph.edges.forEach(function(e){
		callback.call(t, t.spring(e));
	});

	this.extraSprings.forEach(function(s){
		callback.call(t, s);
	});
};


// Physics stuff
Layout.ForceDirected.prototype.applyCoulombsLaw = function()
{
	this.eachNode(function(n1, point1) {
		this.eachNode(function(n2, point2) {
			if (point1 !== point2)
			{
				var d = point1.p.subtract(point2.p);
				var distance = d.magnitude() + 1.0;
				var direction = d.normalise();

				// apply force to each end point
				point1.applyForce(direction.multiply(this.repulsion).divide(distance * distance * 0.5));
				point2.applyForce(direction.multiply(this.repulsion).divide(distance * distance * -0.5));
			}
		});
	});
};

Layout.ForceDirected.prototype.applyHookesLaw = function()
{
	this.eachSpring(function(spring){
		var d = spring.point2.p.subtract(spring.point1.p); // the direction of the spring
		var displacement = spring.length - d.magnitude();
		var direction = d.normalise();

		// apply force to each end point
		spring.point1.applyForce(direction.multiply(spring.k * displacement * -0.5));
		spring.point2.applyForce(direction.multiply(spring.k * displacement * 0.5));
	});
};

Layout.ForceDirected.prototype.attractToCentre = function()
{
	this.eachNode(function(node, point) {
		var direction = point.p.multiply(-1.0);
		point.applyForce(direction.multiply(this.repulsion / 5.0));
	});
};


Layout.ForceDirected.prototype.updateVelocity = function(timestep)
{
	this.eachNode(function(node, point) {
		point.v = point.v.add(point.f.multiply(timestep)).multiply(this.damping);
		point.f = new Layout.ForceDirected.Vector(0,0);
	});
};

Layout.ForceDirected.prototype.updatePosition = function(timestep)
{
	this.eachNode(function(node, point) {
		point.p = point.p.add(point.v.multiply(timestep));
	});
};

Layout.ForceDirected.prototype.totalEnergy = function(timestep)
{
	var energy = 0.0;
	this.eachNode(function(node, point) {
		var speed = point.v.magnitude();
		energy += speed * speed;
	});

	return energy;
};


// start simulation
Layout.ForceDirected.prototype.start = function(interval, render, done)
{
	var t = this;

	if (this.intervalId !== null) {
		return; // already running
	}

	this.intervalId = setInterval(function() {
		t.applyCoulombsLaw();
		t.applyHookesLaw();
		t.attractToCentre();
		t.updateVelocity(0.05);
		t.updatePosition(0.05);

		if (typeof(render) !== 'undefined') { render(); }

		// stop simulation when energy of the system goes below a threshold
		if (t.totalEnergy() < 0.1)
		{
			clearInterval(t.intervalId);
			t.intervalId = null;
			if (typeof(done) !== 'undefined') { done(); }
		}
	}, interval);
};

// Find the nearest point to a particular position
Layout.ForceDirected.prototype.nearest = function(pos)
{
	var min = {node: null, point: null, distance: null};
	var t = this;
	this.graph.nodes.forEach(function(n){
		var point = t.point(n);
		var distance = point.p.subtract(pos).magnitude();

		if (min.distance === null || distance < min.distance)
		{
			min = {node: n, point: point, distance: distance};
		}
	});

	return min;
};

// Vector
Layout.ForceDirected.Vector = function(x, y)
{
	this.x = x;
	this.y = y;
};

Layout.ForceDirected.Vector.random = function()
{
	return new Layout.ForceDirected.Vector(2.0 * (Math.random() - 0.5), 2.0 * (Math.random() - 0.5));
};

Layout.ForceDirected.Vector.prototype.add = function(v2)
{
	return new Layout.ForceDirected.Vector(this.x + v2.x, this.y + v2.y);
};

Layout.ForceDirected.Vector.prototype.subtract = function(v2)
{
	return new Layout.ForceDirected.Vector(this.x - v2.x, this.y - v2.y);
};

Layout.ForceDirected.Vector.prototype.multiply = function(n)
{
	return new Layout.ForceDirected.Vector(this.x * n, this.y * n);
};

Layout.ForceDirected.Vector.prototype.divide = function(n)
{
	return new Layout.ForceDirected.Vector(this.x / n, this.y / n);
};

Layout.ForceDirected.Vector.prototype.magnitude = function()
{
	return Math.sqrt(this.x*this.x + this.y*this.y);
};

Layout.ForceDirected.Vector.prototype.normal = function()
{
	return new Layout.ForceDirected.Vector(-this.y, this.x);
};

Layout.ForceDirected.Vector.prototype.normalise = function()
{
	return this.divide(this.magnitude());
};

// Point
Layout.ForceDirected.Point = function(position, mass)
{
	this.p = position; // position
	this.m = mass; // mass
	this.v = new Layout.ForceDirected.Vector(0, 0); // velocity
	this.f = new Layout.ForceDirected.Vector(0, 0); // force
};

Layout.ForceDirected.Point.prototype.applyForce = function(force)
{
	this.f = this.f.add(force.divide(this.m));
};

// Spring
Layout.ForceDirected.Spring = function(point1, point2, length, k)
{
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

// Renderer handles the layout rendering loop
function Renderer(interval, layout, clear, drawEdge, drawNode)
{
	this.interval = interval;
	this.layout = layout;
	this.clear = clear;
	this.drawEdge = drawEdge;
	this.drawNode = drawNode;

	this.layout.graph.addGraphListener(this);
}

Renderer.prototype.graphChanged = function(e)
{
	this.start();
};

Renderer.prototype.start = function()
{
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
};

