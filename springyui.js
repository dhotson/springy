/**
Copyright (c) 2010 Dennis Hotson

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.
*/
"use strict";

(function() {

jQuery.fn.springy = function(params) {
	const graph = this.graph = params.graph || new Springy.Graph();
	const boosted = true;
	const fontname = "Verdana, sans-serif";
	const nodeTextColor = 'Black';
	const nodeTextAlign = "center";
	const nodeTextBaseline = "middle";
	const selectedShadowColor = 'Aqua';
	const activeShadowColor = 'DarkOrange';
	const activeShadowOffset = 0;
	const passiveShadowColor = "rgba(50, 50, 50, 0.3)";
	const nodeAlpha = '0.8';
	const nodestrokeStyle = "SlateGray";
	const defaultColor1 	= "rgba(176, 224, 230,"+nodeAlpha+")"; // PowderBlue - rgb(176, 224, 230)
	const defaultColor2 	= "rgba(176, 196, 222,"+nodeAlpha+")"; // LightSteelBlue - rgb(176, 196, 222)
	const stiffness = params.stiffness || 400.0;
	const repulsion = params.repulsion || 400.0;
	const damping = params.damping || 0.5;
	const minEnergyThreshold = params.minEnergyThreshold || 0.00001;
	const maxSpeed = params.maxSpeed || 100.0; // nodes aren't allowed to exceed this speed
	const nodeSelected = params.nodeSelected || null;
	const nodePositions = params.nodePositions || null;
	const RenderFrameCall = params.onRenderFrame || null;
	const RenderStopCall = params.onRenderStop || null;
	const RenderStartCall = params.onRenderStart || null;
	const pinWeight = params.pinWeight * 1.0 || 1000.0;
	const exciteMethod = params.exciteMethod || 'none';
	var nodeImages = {};
	const edgeLabelsUpright = true;
	const edgeLabelBoxes = params.edgeLabelBoxes || false;
	const useGradient = params.useGradient || false;
	var fontsize = params.fontsize * 1.0 || Math.max(10.0 - Math.sqrt(graph.nodes.length) / 3.0, 0.5);
	var zoomFactor = params.zoomFactor * 1.0 || 1.0;
	zoomFactor = Math.max(Math.min(zoomFactor, 12), 1);
	fontsize = Math.max(Math.min(fontsize, 30), 1);
	const canvas = this[0];
	const ctx = canvas.getContext("2d");
	var layout = this.layout = new Springy.Layout.ForceDirected(graph, ctx, stiffness, repulsion, damping, minEnergyThreshold, maxSpeed, fontsize, fontname, zoomFactor, pinWeight);

	var color1 = "#7FEFFF"; // blue
	var color2 = "#50C0FF"; 
	var shadowColor = "rgba(50, 50, 50, 0.3)";
	var shadowOffset = fontsize * zoomFactor;
	trackTransforms(ctx);
	// calculate bounding box of graph layout.. with ease-in
	var currentBB = layout.getBoundingBox();
	var targetBB = {bottomleft: new Springy.Vector(-2, -2), topright: new Springy.Vector(2, 2)};
	if (params.selected) {
		layout.selectNode(params.selected);
	}
	if (zoomFactor !== 1.0) {
		ctx.scale(zoomFactor,zoomFactor);
	}
	if (params.x_offset || params.y_offset) {
		ctx.translate(params.x_offset, params.y_offset);
	}
	// auto adjusting bounding box
	Springy.requestAnimationFrame(function adjust() {
		targetBB = layout.getBoundingBox();
		// current gets 20% closer to target every iteration
		currentBB = {
			bottomleft: currentBB.bottomleft.add( targetBB.bottomleft.subtract(currentBB.bottomleft)
				.divide(10)),
			topright: currentBB.topright.add( targetBB.topright.subtract(currentBB.topright)
				.divide(10))
		};

		Springy.requestAnimationFrame(adjust);
	});

	// convert to/from screen coordinates
	var toScreen = function(p) {
		var size = currentBB.topright.subtract(currentBB.bottomleft);
		var sx = p.subtract(currentBB.bottomleft).divide(size.x).x * canvas.width;
		var sy = p.subtract(currentBB.bottomleft).divide(size.y).y * canvas.height;
		return new Springy.Vector(sx, sy);
	};

	var fromScreen = function(s) {
		var size = currentBB.topright.subtract(currentBB.bottomleft);
		var px = (s.x / canvas.width) * size.x + currentBB.bottomleft.x;
		var py = (s.y / canvas.height) * size.y + currentBB.bottomleft.y;
		return new Springy.Vector(px, py);
	};

	var set_2colors = function() {
	  var grd = ctx.createLinearGradient(-100, 100, 100, -100);
	  grd.addColorStop(0, color1);
	  grd.addColorStop(1, color2); 
	  ctx.fillStyle = grd;
	  ctx.shadowColor = shadowColor;
	  ctx.shadowBlur = layout.fontsize*layout.zoomFactor;
	  ctx.shadowOffsetX = shadowOffset; 
	  ctx.shadowOffsetY = shadowOffset;
	};
	var set_1colors = function() {
	  ctx.fillStyle = color1;
	  ctx.shadowColor = shadowColor;
	  ctx.shadowBlur = layout.fontsize*layout.zoomFactor*(shadowOffset===0 ? 2 : 1);
	  ctx.shadowOffsetX = shadowOffset; 
	  ctx.shadowOffsetY = shadowOffset;
	};
	var set_colors = (useGradient)? set_2colors : set_1colors;
	
	var box_shape = function(pos, width, height, shape, first){
	  height = (height*8/14);
	  width = width / 2.0 + height / 2.0;
	  var hh = height / 2.0;
	  ctx.save();
	  ctx.translate(pos.x, pos.y);
	  if (first) {
	    set_colors();
	  } else { 
	    ctx.fillStyle = color1;
	  }
	  switch(shape) {
		case 'box3d':
		  ctx.beginPath();
		  ctx.moveTo(width, height); ctx.lineTo(width+hh, height-hh);
		  ctx.lineTo(width+hh, -height-hh, 0); ctx.lineTo(width, -height);
		  ctx.closePath();
		  ctx.fill();
		  ctx.stroke();
		  ctx.beginPath();
		  ctx.moveTo(width, -height); ctx.lineTo(-width, -height);
		  ctx.lineTo(-width+hh, -height-hh, 0); ctx.lineTo(width+hh, -height-hh);
		  ctx.closePath();
		  ctx.fill();
		  ctx.stroke();
		break;
		case 'folder':
		case 'note':
		break;
		case 'tab':
		  ctx.beginPath();
		  ctx.rect(-width, -height-hh, height+hh, hh);
		  ctx.closePath();
		  ctx.fill();
		  ctx.stroke();
		break;
		case 'Msquare':
		break;
	  }
	  ctx.beginPath();
	  ctx.rect(-width, -height, width*2, height*2);
	  ctx.closePath();
	  ctx.fill();
	  ctx.stroke();
	  
	  switch(shape) {
		case 'component':
		  ctx.beginPath();
		  ctx.rect(-width-hh, -hh-hh/2, height, hh);
		  ctx.closePath();
		  ctx.fill();
		  ctx.stroke();
		  ctx.beginPath();
		  ctx.rect(-width-hh, hh-hh/2, height, hh);
		  ctx.closePath();
		  ctx.fill();
		  ctx.stroke();
		break;
	  }

	  ctx.restore();
	};

	var house = function(pos, width, height, inv){
	  width = width / 2 + height / 3;
	  height = height / 3 * 2;
	  var hh = height / 2;
	  ctx.save();
	  ctx.translate(pos.x, pos.y);
	  set_colors();
	  if (inv) {
		ctx.rotate(Math.PI);
	  }
	  ctx.beginPath();
	  ctx.moveTo(-width, height); ctx.lineTo(width, height);
	  ctx.lineTo(width, 0); ctx.lineTo(0, -height-hh);
	  ctx.lineTo(-width, 0); 
	  ctx.closePath();
	  ctx.fill();
	  ctx.restore();
	  ctx.stroke();
	};

	var parallelogram = function(pos, width, height){
	  width = width / 2 + height / 2;
	  var hh = height;
	  height = height / 3 * 2;
	  ctx.save();
	  ctx.translate(pos.x-(hh/2), pos.y);
	  set_colors();
	  ctx.beginPath();
	  ctx.moveTo(-width, -height); ctx.lineTo(width, -height);
	  ctx.lineTo(width+hh, height); ctx.lineTo(-width+hh, height);
	  ctx.closePath();
	  ctx.fill();
	  ctx.restore();
	  ctx.stroke();
	};

	var trapezium = function(pos, width, height, inv){
	  width = width / 2 + height / 2;
	  var hh = height;
	  height = height / 3 * 2;
	  ctx.save();
	  ctx.translate(pos.x, pos.y);
	  set_colors();
	  if (inv) {
		ctx.rotate(Math.PI);
	  }
	  ctx.beginPath();
	  ctx.moveTo(-width, -height); ctx.lineTo(width, -height);
	  ctx.lineTo(width+hh, height); ctx.lineTo(-width-hh, height);
	  ctx.closePath();
	  ctx.fill();
	  ctx.restore();
	  ctx.stroke();
	};

	var ellipse = function(pos, width, height, first){
	  ctx.save();
	  ctx.translate(pos.x, pos.y);
	  if (width > height) {
	  	width = width / 2 + height;
	  	ctx.scale(1, height / width);
	  } else {
	    width = width / 2;
	  }
	  if (first) {
	    set_colors();
	  } else {
	  	ctx.fillStyle = color1;
	  }
	  ctx.beginPath();
	  ctx.arc(0, 0, width, 0, Math.PI * 2, true);
	  ctx.fill();
	  ctx.restore();
	  ctx.stroke();
	};

	var triangle = function(pos, width, height){
	  var dim = width / 2 + height / 3 * 2;
	  var c1x = pos.x, 
		  c1y = pos.y - height, 
		  c2x = c1x - dim, 
		  c2y = pos.y + 8, 
		  c3x = c1x + dim, 
		  c3y = c2y;
	  set_colors();
	  ctx.beginPath();
	  ctx.moveTo(c1x, c1y);
	  ctx.lineTo(c2x, c2y);
	  ctx.lineTo(c3x, c3y);
	  ctx.closePath();
	  ctx.fill();
	  ctx.stroke();
	};

	var polygon = function(pos, width, height, n, even, first){
	  var pix = 2*Math.PI/n;	// angel in circle
	  var fy = (3*height)/(2*width);		// deformation of circle
	  var dim = (n+1)*(3*height+2*width)/(4*n); // radius
	  ctx.save();
	  ctx.translate(pos.x, pos.y);
	  ctx.scale(1, fy);
	  if (first) {
	      set_colors();
	  } else {
	      ctx.fillStyle = color1;
	  }
	  if (even) {
		ctx.rotate(pix/2 + Math.PI/2*even); // flat bottom line
	  } else {
		ctx.rotate(Math.PI/2);			// standing on corner
	  }
	  ctx.beginPath();
	  ctx.moveTo(dim, 0);
	  while(n--) {
		ctx.rotate(pix);
		ctx.lineTo(dim, 0);
	  }
	  ctx.fill();
	  ctx.restore();
	  ctx.stroke();
	};

	var star = function(pos, width, height){
	  var dim = height * 4 / 3;
	  var pi5 = Math.PI / 5;
	  ctx.save();
	  ctx.translate(pos.x, pos.y);
	  set_colors();
	  ctx.beginPath();
	  ctx.moveTo(dim, 0);
	  for (var i = 0; i < 9; i++) {
		ctx.rotate(pi5);
		if (i % 2 == 0) {
		  ctx.lineTo((dim / 0.525731) * 0.200811, 0);
		} else {
		  ctx.lineTo(dim, 0);
		}
	  }
	  ctx.closePath();
	  ctx.fill();
	  ctx.restore();
	  ctx.stroke();
	};

	// drag and drop
	var nearest = null;
	var dragged = null;
	var point_clicked = null;
	var inside_node = false;
	var lastX=canvas.width/2, lastY=canvas.height/2;
	var dragStart = null;
	var canvas_dragged;
	var tapedTwice = false;
	
	var mouse_inside_node = function(item, mp) {
		if (item !== null && item.node !== null && typeof(item.inside) == 'undefined') {
			var node = item.node;
			var boxWidth = node.getWidth(layout);
			var boxHeight = node.getHeight(layout);
			var pos = toScreen(item.point.p);
			var p = toScreen(mp);
			var diffx = Math.abs(pos.x - p.x);
			var diffy = Math.abs(pos.y - p.y);

			inside_node = (diffx <= boxWidth/2 && diffy <= boxHeight) ? true : false;
			item.inside = inside_node;
		}
	};

	var snap_to_canvas = function() {
		// move upper left corner and lower right corner inside canvas
		var diffx = 0;
		var diffy = 0;
		var diffx2 = 0;
		var diffy2 = 0;

		var xform = ctx.getTransform();
		var xsize = canvas.width * xform.a;
		var ysize = canvas.height * xform.a;
		var xoffset = xform.e;
		var yoffset = xform.f;
		
		if (xoffset > 0) 
			diffx = -xoffset;
		if (xoffset < 0 && xoffset + xsize < canvas.width)
			diffx = canvas.width - (xoffset + xsize);

		if (yoffset > 0) 
			diffy = -yoffset;
		if (yoffset < 0 && yoffset + ysize < canvas.height)
			diffy =	 canvas.height - (yoffset + ysize);
		ctx.translate(diffx, diffy);
	};

	var mousedown = function(canvas, pageX, pageY, offsetX, offsetY){
		var pos = jQuery(canvas).offset();	// offsets in html window
		var p1 = ctx.transformedPoint(pageX - pos.left, pageY - pos.top); // real canvas offsets
		var p = fromScreen(p1);											// internal offsets relative to current BB
		layout.selected = nearest = dragged = layout.nearest(p);
		point_clicked = p;
		mouse_inside_node(layout.selected, p);
		if (layout.selected.inside) {
			// DS 13.Oct 2019 : pin or just move selected node depending on pinWeight
			dragged.point.m = layout.pinWeight;
			layout.propagateExcitement();
			
			if (nodeSelected) {
				nodeSelected(layout.selected.node, false);
			}
		} else {
			lastX = offsetX || (pageX - pos.left);
			lastY = offsetY || (pageY - pos.top);
			
			dragStart = ctx.transformedPoint(lastX,lastY);
			canvas_dragged = false;
		}

		renderer.start(layout.selected.inside);
	};

	jQuery(canvas).mousedown(function(e) {
		mousedown(this, e.pageX, e.pageY, e.offsetX, e.offsetY);
	});

	// Basic double click handler
	var doubleclick = function(canvas, pageX, pageY){
		var pos = jQuery(canvas).offset();
		var p = fromScreen({x: pageX - pos.left, y: pageY - pos.top});
		if (layout.selected && layout.selected.inside) {
			var node = layout.selected.node;
			if (node && node.data) {
				if (node.data.ondoubleclick) {
					node.data.ondoubleclick();
				}
				if (nodeSelected) {
					nodeSelected(layout.selected.node, true);
				}
			}
		}
	};
	
	jQuery(canvas).dblclick(function(e) {
		doubleclick(this, e.pageX, e.pageY);
	});

	var moveViewport = function(canvas, startx, starty, lastX, lastY) {
		var pt = ctx.transformedPoint(lastX,lastY);
		var diffx = pt.x-startx;
		var diffy = pt.y-starty;
		var xform = ctx.getTransform();
		var xsize = canvas.width * xform.a;
		var ysize = canvas.height * xform.a;
		var xoffset = xform.e;
		var yoffset = xform.f;
		// 0 limit left:
		if (diffx > 0 && xoffset + diffx > 0) {
			diffx = 0;
		}
		// 0 limit right:
		if (diffx < 0 && (xoffset + diffx + xsize) < canvas.width) {
			diffx = 0;
		}
		// 0 limit top:
		if (diffy > 0 && yoffset+diffy > 0) {
			diffy = 0;
		}
		// 0 limit bottom:
		if (diffy < 0 && (yoffset + diffy + ysize) < canvas.height) {
			diffy = 0;
		}
		ctx.translate(diffx, diffy);
		snap_to_canvas();
	}
	
	var mousemove = function(canvas, pageX, pageY, offsetX, offsetY){
		var pos = $(canvas).offset();
		var p1 = ctx.transformedPoint(pageX - pos.left, pageY - pos.top);
		var p = fromScreen(p1);
		nearest = layout.nearest(p);
		mouse_inside_node(nearest, p);
		if (dragged !== null && dragged.node !== null && dragged.inside) {
			dragged.point.p.x = p.x;
			dragged.point.p.y = p.y;
		} else {
			lastX = offsetX || (pageX - pos.left);
			lastY = offsetY || (pageY - pos.top);
			canvas_dragged = true;
			if (dragStart !== null){
				moveViewport (canvas, dragStart.x, dragStart.y, lastX, lastY);
			}
		}
		renderer.start(dragged !== null && dragged.inside);
	};

	jQuery(canvas).mousemove(function(e) {
		mousemove(this, e.pageX, e.pageY, e.offsetX, e.offsetY);
	});
	
	jQuery(canvas).on('touchstart', function(e){
		let t = e.changedTouches[0]; // first finger
		if (!tapedTwice) {
        	tapedTwice = true;
			setTimeout( function() { tapedTwice = false; }, 300 );

			mousedown(this, t.pageX, t.pageY, t.offsetX, t.offsetY);
		} else {
			doubleclick(this, t.pageX, t.pageY);
		}
	    e.preventDefault();
	});
	
	jQuery(canvas).on('touchmove', function(e){
		let t = e.changedTouches[0]; // erster Finger
		mousemove(this, t.pageX, t.pageY, t.offsetX, t.offsetY);
	    e.preventDefault();
	});
	
	jQuery(canvas).on('touchend', function(e){
		nearest = null;
		dragged = null;
		dragStart = null;
		renderer.start(true);
	    e.preventDefault();
	});

	jQuery(canvas).mouseleave(function(e) {
		nearest = null;
		dragged = null;
		dragStart = null;
		renderer.start(true);
	});

	jQuery(window).bind('mouseup',function(e) {
		dragged = null;
		dragStart = null;
	});
	// -------------------------------------------------
	
	var zoom = function(clicks){
		if (! inside_node) {
			let factor = Math.pow(layout.scaleFactor,clicks);
			let pt = ctx.transformedPoint(lastX,lastY);
			let zoomFactor = layout.zoomFactor;
			ctx.translate(pt.x,pt.y);
			if (factor < 1) {
				// avoid negative zoom
				if (zoomFactor * factor < 1) factor = 1.0/zoomFactor;
				ctx.scale(factor,factor);
				zoomFactor = zoomFactor * factor;
			}
			if (factor > 1 && zoomFactor < 12) {
				ctx.scale(factor,factor);
				zoomFactor = zoomFactor * factor;
			}
			ctx.translate(-pt.x,-pt.y);
			if (clicks < 0)
				snap_to_canvas();
			layout.zoomFactor = zoomFactor;
			layout.scaleFontSize(1.0);
		} else {
			let factor = Math.pow(layout.scaleFactor,clicks);
			layout.scaleFontSize(factor);
		} 
		renderer.start(true);
	}

	var handleScroll = function(evt){
		var delta = evt.wheelDelta ? evt.wheelDelta/40 : evt.detail ? -evt.detail : 0;
		if (delta) zoom(delta);
		return evt.preventDefault() && false;
	};
	
	canvas.addEventListener('DOMMouseScroll',handleScroll,false);
	canvas.addEventListener('mousewheel',handleScroll,false);
	
	var handleGesture = function(evt){
		var delta = evt.scale ? evt.scale / 20 : 0;
		if (delta) zoom(delta);
		return evt.preventDefault() && false;
	};
	
	canvas.addEventListener('gesturestart',handleGesture,false);
	canvas.addEventListener('gesturechange',handleGesture,false);
	canvas.addEventListener('gestureend',handleGesture,false);
	// -------------------------------------------------

	// Adds ctx.getTransform() - returns an SVGMatrix
	// Adds ctx.transformedPoint(x,y) - returns an SVGPoint
	function trackTransforms(ctx){
		var svg = document.createElementNS("http://www.w3.org/2000/svg",'svg');
		var xform = svg.createSVGMatrix();
		ctx.getTransform = function(){ return xform; };
		
		var savedTransforms = [];
		var save = ctx.save;
		ctx.save = function(){
			savedTransforms.push(xform.translate(0,0));
			return save.call(ctx);
		};
		var restore = ctx.restore;
		ctx.restore = function(){
			xform = savedTransforms.pop();
			return restore.call(ctx);
		};

		var scale = ctx.scale;
		ctx.scale = function(sx,sy){
			xform = xform.scaleNonUniform(sx,sy);
			return scale.call(ctx,sx,sy);
		};
		var rotate = ctx.rotate;
		ctx.rotate = function(radians){
			xform = xform.rotate(radians*180/Math.PI);
			return rotate.call(ctx,radians);
		};
		var translate = ctx.translate;
		ctx.translate = function(dx,dy){
			xform = xform.translate(dx,dy);
			return translate.call(ctx,dx,dy);
		};
		var transform = ctx.transform;
		ctx.transform = function(a,b,c,d,e,f){
			var m2 = svg.createSVGMatrix();
			m2.a=a; m2.b=b; m2.c=c; m2.d=d; m2.e=e; m2.f=f;
			xform = xform.multiply(m2);
			return transform.call(ctx,a,b,c,d,e,f);
		};
		var setTransform = ctx.setTransform;
		ctx.setTransform = function(a,b,c,d,e,f){
			xform.a = a;
			xform.b = b;
			xform.c = c;
			xform.d = d;
			xform.e = e;
			xform.f = f;
			return setTransform.call(ctx,a,b,c,d,e,f);
		};
		var pt	= svg.createSVGPoint();
		ctx.transformedPoint = function(x,y){
			pt.x=x; pt.y=y;
			return pt.matrixTransform(xform.inverse());
		}
	}

	var getTextWidth = boosted ? function(node, layout) {
		var ctx = layout.ctx;
		if (node._width && node.fontsize === layout.fontsize)
			return node._width;
		var text = (node.data.label !== undefined && node.data.label) ? node.data.label : node.id;
		ctx.save();
		ctx.font = layout.nodeFont;
		node._width = ctx.measureText(text).width;
		node.fontsize = layout.fontsize;
		ctx.restore();
		return node._width;
	} :
	function(node, layout) {
		var ctx = layout.ctx;
		var text = (node.data.label !== undefined) ? node.data.label : node.id;
		if (node._width && node.fontsize === layout.fontsize && node._width[text])
			return node._width[text];

		ctx.save();
		ctx.font = layout.nodeFont;
		var width = ctx.measureText(text).width;
		ctx.restore();

		node._width || (node._width = {});
		node._width[text] = width;
		node.fontsize = layout.fontsize;

		return width;
	};

	var getTextHeight = function(node, layout) {
		return layout.fontsize;
		// In a more modular world, this would actually read the font size, but I think leaving it a constant is sufficient for now.
		// If you change the font size, I'd adjust this too.
	};

	var getImageWidth = function(node) {
		var width = (node.data.image.width !== undefined) ? node.data.image.width : nodeImages[node.data.image.src].object.width;
		return width;
	}

	var getImageHeight = function(node) {
		var height = (node.data.image.height !== undefined) ? node.data.image.height : nodeImages[node.data.image.src].object.height;
		return height;
	}

	Springy.Node.prototype.getHeight = function(layout) {
		var height;
		if (this.data.image == undefined) {
			height = layout.fontsize;
		} else {
			if (this.data.image.src in nodeImages && nodeImages[this.data.image.src].loaded) {
				height = getImageHeight(this);
			} else {height = 10;}
		}
		return height;
	}

	Springy.Node.prototype.getWidth = function(layout) {
		var width;
		if (this.data.image == undefined) {
			width = getTextWidth(this, layout);
		} else {
			if (this.data.image.src in nodeImages && nodeImages[this.data.image.src].loaded) {
				width = getImageWidth(this);
			} else {width = 10;}
		}
		return width;
	}

	var renderer = this.renderer = new Springy.Renderer(layout,
		function clear() {
			ctx.clearRect(0,0,canvas.width,canvas.height);
		},
		function drawEdge(edge, p1, p2) {
			const x1 = toScreen(p1).x;
			const y1 = toScreen(p1).y;
			const x2 = toScreen(p2).x;
			const y2 = toScreen(p2).y;

			const direction = new Springy.Vector(x2-x1, y2-y1);
			const normal = direction.normal().normalise();

			const from = graph.getEdges(edge.source, edge.target);
			const to = graph.getEdges(edge.target, edge.source);

			const total = from.length + to.length;

			// Figure out edge's position in relation to other edges between the same nodes
			let n = 0;
			for (var i=0; i<from.length; i++) {
				if (from[i].id === edge.id) {
					n = i;
				}
			}

			//change default to  10.0 to allow text fit between edges
			const spacing = layout.fontsize;

			// Figure out how far off center the line should be drawn
			const offset = normal.multiply(-((total - 1) * spacing)/2.0 + (n * spacing));

			const s1 = toScreen(p1).add(offset);
			const s2 = toScreen(p2).add(offset);

			let boxWidth = edge.target.getWidth(layout) * 1.2;
			let boxHeight = edge.target.getHeight(layout) * 2.0; // extra space for target polygons

			let intersection = intersect_line_box(s1, s2, {x: x2-boxWidth/2.0, y: y2-boxHeight/2.0}, boxWidth, boxHeight);

			if (!intersection) {
				intersection = s2;
			}

			boxWidth = edge.source.getWidth(layout) * 1.2;
			boxHeight = edge.source.getHeight(layout) * 2.0; // extra space for source polygons
			
			// DS: respect source node!
			let lineStart = intersect_line_box(s1, s2, {x: x1-boxWidth/2.0, y: y1-boxHeight/2.0}, boxWidth, boxHeight);
			
			if (!lineStart) {
				lineStart = s1;
			}

			let stroke = (edge.data.color !== undefined) ? edge.data.color : '#000000';
			let weight = (edge.data.weight !== undefined) ? edge.data.weight : 1.0;
			weight *= Math.max(layout.fontsize/8, 1/layout.zoomFactor*0.3333);
			if (layout.isSelectedEdge(edge)) {
				// highlight edges of the selected node
				weight = weight * 2;
				stroke = "rgba(255, 140, 0,0.7)"; 
			}
			ctx.save(); // DS: add save
			ctx.lineWidth = Math.max(weight, 0.1);
			const arrowWidth = layout.fontsize / 2;
			const arrowLength = layout.fontsize*1.8;

			const directional = (edge.data.directional !== undefined) ? edge.data.directional : true;

			// line
			let lineEnd;
			if (directional) {
				lineEnd = intersection.subtract(direction.normalise().multiply(arrowLength * 0.5));
			} else {
				lineEnd = intersection; // DS: respect target node!
			}

			ctx.strokeStyle = stroke;
			ctx.beginPath();
			ctx.moveTo(lineStart.x, lineStart.y); // DS: respect source node!
			ctx.lineTo(lineEnd.x, lineEnd.y);
			ctx.stroke();
			ctx.restore(); // DS: add restore
			// arrow
			if (directional) {
				ctx.save();
				ctx.fillStyle = stroke;
				ctx.translate(intersection.x, intersection.y);
				ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
				ctx.beginPath();
				ctx.moveTo(-arrowLength, arrowWidth);
				ctx.lineTo(0, 0);
				ctx.lineTo(-arrowLength, -arrowWidth);
				ctx.lineTo(-arrowLength * 0.8, -0);
				ctx.closePath();
				ctx.fill();
				ctx.restore();
			}

			// label
			if (edge.data.label !== undefined && edge.data.label.length) {
				let text = edge.data.label;
				if (layout.realEdgeFontsize > 2.4) { // DS: hide tiny label
					ctx.save();
					ctx.textAlign = "center";
					ctx.font = layout.edgeFont; 
					if (edgeLabelBoxes) {
						let boxWidth = ctx.measureText(text).width * 1.1;
						let px = (x1+x2)/2;
						let py = (y1+y2)/2 - layout.fontsize/2;
						ctx.textBaseline = "top";
						ctx.fillStyle = "#EEEEEE"; // label background
						ctx.fillRect(px-boxWidth/2, py, boxWidth, layout.fontsize);

						ctx.fillStyle = "darkred";
						ctx.fillText(text, px, py);
					} else {
						ctx.textBaseline = "middle";
						ctx.fillStyle = stroke;
						let angle = Math.atan2(s2.y - s1.y, s2.x - s1.x);
						let displacement = -(layout.edgeFontsize / 10.0);
						if (edgeLabelsUpright && (angle > Math.PI/2 || angle < -Math.PI/2)) {
							displacement = layout.edgeFontsize / 3.0;
							angle += Math.PI;
						}
						let textPos = s1.add(s2).divide(2).add(normal.multiply(displacement));
						ctx.translate(textPos.x, textPos.y);
						ctx.rotate(angle);
						ctx.fillText(text, 0,-2);
					}
					ctx.restore();
				}
			}

		},
		function drawNode(node, p) {
			const s = toScreen(p);
			const boxWidth = node.getWidth(layout);
			const boxHeight = node.getHeight(layout) * 1.2;
			var textColor = nodeTextColor;
			// fill background
			if (layout.isSelectedNode(node.id)) {
				shadowColor = selectedShadowColor;
				shadowOffset = activeShadowOffset;
			} else if (layout.isExcitedNode(node.id)) {
				shadowColor = activeShadowColor;
				shadowOffset = activeShadowOffset;
			} else {
				shadowColor = passiveShadowColor;
				shadowOffset = layout.realFontsize;
			}
			if (typeof(node.data.color) !== 'undefined') {
				color1 = node.data.color;
				color2 = node.data.color;
			} else {
				color1 = defaultColor1;
				color2 = defaultColor2;
			}
			if (node.data.image == undefined) {
				ctx.save();
				ctx.lineWidth = layout.fontsize/12;
				ctx.strokeStyle = nodestrokeStyle;

				/********* Draw Shape **********/
				/*******************************/
				var shape = typeof(node.data.shape) !== 'undefined' ? node.data.shape : 'box';
				switch(shape) {
				case 'plaintext':
				case 'none':
				break;
				case 'box':
				case 'box3d':
				case 'folder':
				case 'note':
				case 'tab':
				case 'component':
				case 'Msquare':
					box_shape(s, boxWidth, boxHeight, shape, true);
				break;
				case 'doublebox':
					box_shape(s, boxWidth*1.1, boxHeight*1.2, shape, true);
					box_shape(s, boxWidth, boxHeight, shape, false);
				break;
				case 'house':
					house(s, boxWidth, boxHeight, false);
				break;
				case 'invhouse':
					house(s, boxWidth, boxHeight, true);
				break;
				case 'circle':
					ellipse(s, boxWidth+boxHeight, boxWidth+boxHeight, true);
				break;
				case 'ellipse':
					ellipse(s, boxWidth, boxHeight, true);
				break;
				case 'doublecircle':
					ellipse(s, boxWidth*1.1, boxHeight*1.2, true);
					ellipse(s, boxWidth, boxHeight, false);
				break;
				case 'point':
					textColor = 'DarkGray';
					ellipse(s, boxHeight, boxHeight, true);
				break;
				case 'triangle':
					triangle(s, boxWidth, boxHeight);
				break;
				case 'righttriangle':
					polygon(s, boxWidth*1.5, boxHeight, 3, 2, true);
				break;
				case 'lefttriangle':
					polygon(s, boxWidth*1.4, boxHeight, 3, 4, true);
				break;
				case 'invtriangle':
					polygon(s, boxWidth, boxHeight, 3, false, true);
				break;
				case 'rectangle':
					polygon(s, boxWidth, boxHeight, 4, true, true);
				break;
				case 'diamond':
					polygon(s, boxWidth, boxHeight, 4, false, true);
				break;
				case 'pentagon':
					polygon(s, boxWidth, boxHeight, 5, true, true);
				break;
				case 'hexagon':
					polygon(s, boxWidth, boxHeight, 6, true, true);
				break;
				case 'septagon':
					polygon(s, boxWidth, boxHeight, 7, true, true);
				break;
				case 'octagon':
					polygon(s, boxWidth, boxHeight, 8, true, true);
				break;
				case 'doubleoctagon':
					polygon(s, boxWidth*0.91, boxHeight*1.2, 8, true, true);
					polygon(s, boxWidth*0.9, boxHeight, 8, true, false);
				break;
				case 'tripleoctagon':
					polygon(s, boxWidth*1.05, boxHeight*1.2, 8, true, true);
					polygon(s, boxWidth, boxHeight, 8, true, false);
					polygon(s, boxWidth*0.97, boxHeight*0.8, 8, true, false);
				break;
				case 'star':
					textColor = 'DarkGray';
					star(s, boxWidth, boxHeight);
				break;
				case 'trapezium':
					trapezium(s, boxWidth, boxHeight, false);
				break;
				case 'invtrapezium':
					trapezium(s, boxWidth, boxHeight, true);
				break;
				case 'parallelogram':
					parallelogram(s, boxWidth, boxHeight*1.1);
				break;
				default:
					box_shape(s, boxWidth, boxHeight, shape, true);
				}
				ctx.translate(s.x, s.y);
				// Node Label Text
				if (layout.realFontsize > 2.4) { // DS: hide tiny label
					ctx.textAlign = nodeTextAlign;
					ctx.textBaseline = nodeTextBaseline;
					ctx.font = layout.nodeFont; 
					ctx.fillStyle = textColor;
					let text = typeof(node.data.label) !== 'undefined' ? node.data.label : node.id;
					ctx.fillText(text, 0, 0);
				}
				ctx.restore();
			} else {
				// Currently we just ignore any labels if the image object is set. One might want to extend this logic to allow for both, or other composite nodes.
				var src = node.data.image.src;  // There should probably be a sanity check here too, but un-src-ed images aren't exaclty a disaster.
				if (src in nodeImages) {
					if (nodeImages[src].loaded) {
						// Our image is loaded, so it's safe to draw
						ctx.drawImage(nodeImages[src].object, s.x - contentWidth/2, s.y - contentHeight/2, contentWidth, contentHeight);
					}
				}else{
					// First time seeing an image with this src address, so add it to our set of image objects
					// Note: we index images by their src to avoid making too many duplicates
					nodeImages[src] = {};
					let img = new Image();
					nodeImages[src].object = img;
					img.addEventListener("load", function () {
						// HTMLImageElement objects are very finicky about being used before they are loaded, so we set a flag when it is done
						nodeImages[src].loaded = true;
					});
					img.src = src;
				}
			}
		},
		function getCanvasPos() {
			var xform = ctx.getTransform();
			var canvasPos = {};
			canvasPos.fontsize = layout.fontsize;
			canvasPos.zoomFactor = layout.zoomFactor; // = xform.e = xform.d
			canvasPos.x_offset = xform.e / layout.zoomFactor;
			canvasPos.y_offset = xform.f / layout.zoomFactor;
			canvasPos.energy = layout.energy;
			canvasPos.fps = layout.fps;
			return canvasPos;
		},
		function onRenderStop() {
			if (RenderStopCall) 
				RenderStopCall(renderer);
		},
		function onRenderStart() {
			if (RenderStartCall) 
				RenderStartCall(renderer);
		},
		function onRenderFrame() {
			if (RenderFrameCall) 
				RenderFrameCall(renderer);
		},
		function zoomCanvas(factor) {
			let pt = ctx.transformedPoint(canvas.width/2,canvas.height/2);
			ctx.translate(pt.x,pt.y);
			ctx.scale(factor,factor);
			ctx.translate(-pt.x,-pt.y);
			if (factor < 1) {
				ctx.clearRect(0,0,canvas.width,canvas.height);
				snap_to_canvas();
			}
		},
		function moveCanvas(p) {
			// center view port over selected node
			var pos = toScreen(p); // selected node point
			var zoomFactor = layout.zoomFactor;
			//console.log('moveCanvas - pos      :'+(pos.x * zoomFactor)+', '+(pos.y * zoomFactor));
			//console.log('moveCanvas - canvas/2 :'+(canvas.width/2)+', '+(canvas.height/2) );
			var xform = ctx.getTransform();
			//console.log('moveCanvas - offset   :'+xform.e+', '+xform.f+', factor '+layout.zoomFactor);
			let diffx = -((pos.x * zoomFactor) - (canvas.width/2) + xform.e)/layout.zoomFactor;
			let diffy = -((pos.y * zoomFactor) - (canvas.height/2) + xform.f)/layout.zoomFactor;
			//console.log('moveCanvas - diff     :'+diffx+', '+diffy);
			ctx.translate(diffx, diffy);
			ctx.clearRect(0,0,canvas.width,canvas.height);
			snap_to_canvas();
		}
	);
	renderer.setExciteMethod(exciteMethod);
	renderer.optimizeMass(1);
	renderer.start(true);

	// helpers for figuring out where to draw arrows
	function intersect_line_line(p1, p2, p3, p4) {
		var denom = ((p4.y - p3.y)*(p2.x - p1.x) - (p4.x - p3.x)*(p2.y - p1.y));

		// lines are parallel
		if (denom === 0) {
			return false;
		}

		var ua = ((p4.x - p3.x)*(p1.y - p3.y) - (p4.y - p3.y)*(p1.x - p3.x)) / denom;
		var ub = ((p2.x - p1.x)*(p1.y - p3.y) - (p2.y - p1.y)*(p1.x - p3.x)) / denom;

		if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
			return false;
		}

		return new Springy.Vector(p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y));
	}

	function intersect_line_box(p1, p2, p3, w, h) {
		var tl = {x: p3.x, y: p3.y};
		var tr = {x: p3.x + w, y: p3.y};
		var bl = {x: p3.x, y: p3.y + h};
		var br = {x: p3.x + w, y: p3.y + h};

		var result;
		if (result = intersect_line_line(p1, p2, tl, tr)) { return result; } // top
		if (result = intersect_line_line(p1, p2, tr, br)) { return result; } // right
		if (result = intersect_line_line(p1, p2, br, bl)) { return result; } // bottom
		if (result = intersect_line_line(p1, p2, bl, tl)) { return result; } // left

		return false;
	}
	return this;
}

})();
