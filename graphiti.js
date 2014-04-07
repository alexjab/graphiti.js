var Plane = function (canvas, options) {
  this.canvas = canvas;
  this.ctx = canvas.getContext ('2d');
  this.height = canvas.height;
  this.width = canvas.width;
  this.node_l = [];
  this.node_o = {};
  this.link_l = [];
  this.link_o = {};

  options = options || {};
  this.nodeRadius = options.nodeRadius || 10;

  return this;
};

Plane.prototype.createNode = function (id) {
  var n = new Node (this, id);
  this.node_l.push (n);
  this.node_o[id] = n;

  return n;
};

Plane.prototype.createLink = function (na, nb) {
  var l = new Link (this, na, nb);
  this.link_l.push (l);
  this.link_o[na.id+':'+nb.id] = l;

  return l;
};

Plane.prototype.draw = function (item) {
  if (!item) {
    this.link_l.forEach (function (link) {
      link.drawLink ();
    }, this);
    this.node_l.forEach (function (node) {
      node.drawNode ();
    }, this);
  } else {
    if (item.link) {
      this.link_l.forEach (function (link) {
        if (item.link.id === link.id) {
          link.drawLink (true);
        } else {
          link.drawLink ();
        }
      }, this);
      this.node_l.forEach (function (node) {
        node.drawNode ();
      }, this);
    }
    if (item.node) {
      this.node_l.forEach (function (node) {
        if (item.node.id === node.id) {
          node.drawNode (true);
        } else {
          node.drawNode ();
        }
      }, this);
      this.link_l.forEach (function (link) {
        link.drawLink ();
      }, this);
    }
  }

  return this;
};

Plane.prototype.clear = function () {
  this.ctx.clearRect (0, 0, this.width, this.height);
  return this;
};

Plane.prototype.highlight = function (item) {
  this.draw.apply (this, [item]);
};

Plane.prototype.organize = function (rule) {
  if (rule === 'random') {
    this.node_l.forEach (function (node) {
      node.x = Math.random ()*(this.width - 2*this.nodeRadius) + this.nodeRadius;
      node.y = Math.random ()*(this.height - 2*this.nodeRadius) + this.nodeRadius;
      this.node_o[node.id] = node;
    }, this);
  }
};

Plane.prototype.on = function (evt, cb) {
  this.canvas.addEventListener (evt, function (e) {
    cb (e);
  });
};

Plane.prototype.getMousePosition = function (e) {
  var rect = this.canvas.getBoundingClientRect ();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
};


var EventLayer = function (plane, options) {
  this.plane = plane;
  this.link_l = [];
  this.node_l = [];

  options = options || {};
  this.showTrace = options.showTrace || false;
  this.linkModel = options.linkModel || 'circle';
  this.linkAccuracy = options.linkAccuracy || 10.0;
  this.linkOverlapRatio = options.linkOverlapRatio || this.linkModel === 'circle'?1.5:1.0;
  this.nodeModel = options.nodeModel || 'circle';
  this.nodeOverflowRatio = options.nodeOverflowRatio || this.linkModel === 'circle'?1.2:1.5;
};

EventLayer.prototype.connect = function () {
  this.plane.link_l.forEach (function (link) {
    var length = link.length ();
    var acc = 2*this.linkAccuracy;
    var overlapRatio = this.linkOverlapRatio;
    for (var i = 1;i < Math.ceil (overlapRatio*length/acc);i++) {
      var x = link.head.x + (link.tail.x - link.head.x)*(i*acc/(length*overlapRatio));
      var y = link.head.y + (link.tail.y - link.head.y)*(i*acc/(length*overlapRatio));
      this.link_l.push ({ link: link, x: x, y: y });
      if (this.showTrace) {
        this.drawTrace.apply (this, [x, y]);
      };
    }
  }, this);
  this.plane.node_l.forEach (function (node) {
    var overflowRatio = this.nodeOverflowRatio;
    this.node_l.push ({ node: node, x: node.x, y: node.y });
    if (this.showTrace) {
      this.drawTrace.apply (this, [node.x, node.y]);
    };
  }, this);
  if (this.showTrace) {
    this.plane.ctx.strokeStyle='#000';
  }

  return this;
};

EventLayer.prototype.drawTrace = function (x, y) {
  this.plane.ctx.strokeStyle='#F00';
  var acc = this.linkAccuracy;
  var model = this.linkModel;
  if (model === 'square') {
    this.plane.ctx.strokeRect (x-acc, y-acc, 2*acc, 2*acc);
  } else if (model === 'circle') {
    this.plane.ctx.beginPath ();
    this.plane.ctx.arc (x,y,acc,0,2*Math.PI);
    this.plane.ctx.stroke ();
    this.plane.ctx.closePath ();
  }

  return this;
};

EventLayer.prototype.getItemByPosition = function (x, y) {
  var model = this.linkModel;
  var self = this;

  var return_node = this.node_l.reduce (function (memo, item) {
    var acc = self.nodeOverflowRatio*self.plane.nodeRadius;
    if (model === 'square') {
      if (x > item.x - acc && x < item.x + acc && y > item.y - acc && y < item.y + acc)
        return item;
    } else if (model === 'circle') {
      if ((x - item.x)*(x - item.x) + (y - item.y)*(y - item.y) < acc*acc) {
        return item;
      }
    }
    return memo;
  }, null);
  var return_link = this.link_l.reduce (function (memo, item) {
    var acc = self.linkAccuracy;
    if (model === 'square') {
      if (x > item.x - acc && x < item.x + acc && y > item.y - acc && y < item.y + acc)
        return item;
    } else if (model === 'circle') {
      if ((x - item.x)*(x - item.x) + (y - item.y)*(y - item.y) < acc*acc) {
        return item;
      }
    }
    return memo;
  }, null);
  return return_node || return_link;
};

var Link = function (plane, na, nb) {
  this.id = na.id+':'+nb.id;
  this.plane = plane;
  this.head = na;
  this.tail = nb;
  this.cost = 0;
};

Link.prototype.drawLink = function (highlight) {
  this.plane.ctx.beginPath ();
  var cos_head = (this.tail.x - this.head.x)/this.length ();
  var sin_head = (this.tail.y - this.head.y)/this.length ();
  var cos_tail = (this.tail.x - this.head.x)/this.length ();
  var sin_tail = (this.tail.y - this.head.y)/this.length ();
  var radius = this.plane.nodeRadius;
  this.plane.ctx.moveTo (this.head.x + cos_head*radius, this.head.y + sin_tail*radius);
  if (highlight) {
    this.plane.ctx.lineWidth=4;
  }
  this.plane.ctx.lineTo (this.tail.x - cos_tail*radius, this.tail.y - sin_tail*radius);
  this.plane.ctx.stroke ();
  this.plane.ctx.closePath ();
  this.plane.ctx.lineWidth=1;

  return this;
};

Link.prototype.length = function () {
  return Math.sqrt ((this.tail.x - this.head.x)*(this.tail.x - this.head.x) + (this.tail.y - this.head.y)*(this.tail.y - this.head.y));
};

var Node = function (plane, id) {
  this.plane = plane;
  this.id = id;

  this.title = '';
  this.x = 0;
  this.y = 0;

  return this;
};

Node.prototype.drawNode = function (highlight) {
  this.plane.ctx.beginPath ();
  this.plane.ctx.strokeStyle="#000";
  if (highlight) {
    this.plane.ctx.lineWidth=4;
  }
  this.plane.ctx.arc (this.x,this.y,this.plane.nodeRadius,0,2*Math.PI);
  this.plane.ctx.stroke ();
  this.plane.ctx.closePath ();
  this.plane.ctx.lineWidth=1;

  return this;
};
