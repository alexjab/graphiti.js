var Plane = function (canvas, options) {
  this.canvas = canvas;
  this.ctx = canvas.getContext ('2d');
  this.height = canvas.height;
  this.width = canvas.width;
  this.nodes = [];
  this.links = [];

  options = options || {};
  this.nodeRadius = options.nodeRadius || 10;
  this.showNodeTitle = options.showNodeTitle || true;
  this.showLinkTitle = options.showLinkTitle || false;

  return this;
};

Plane.prototype.createNode = function (id) {
  var n = new Node (this, id);
  this.nodes.push (n);

  return n;
};

Plane.prototype.createLink = function (na, nb) {
  var l = new Link (this, na, nb);
  this.links.push (l);

  return l;
};

Plane.prototype.draw = function () {
  this.links.forEach (function (link) {
    link.draw ();
  }, this);
  this.nodes.forEach (function (node) {
    node.draw ();
  }, this);

  return this;
};

Plane.prototype.clear = function () {
  this.ctx.clearRect (0, 0, this.width, this.height);
  return this;
};

Plane.prototype.highlight = function (item) {
  item.item.draw (true);
};

Plane.prototype.organize = function (rule) {
  if (rule === 'random') {
    this.nodes.forEach (function (node) {
      node.x = Math.random ()*(this.width - 2*this.nodeRadius) + this.nodeRadius;
      node.y = Math.random ()*(this.height - 2*this.nodeRadius) + this.nodeRadius;
    }, this);
  }
  if (rule === 'harmony') {
    var nb = this.nodes.length;
    this.nodes.forEach (function (node, index) {
      var min = Math.PI*2*index/nb;
      var max = Math.PI*2*(index+1)/nb;
      var rand_angle = Math.random ()*(max - min) + min;
      var rand_radius = Math.random ()*(this.width/2 - this.width/8) + this.width/8;
      var rand_radius = 125;

      var cos = this.width/2 + rand_radius*Math.cos (rand_angle);
      var sin = this.width/2 + rand_radius*Math.sin (rand_angle);

      node.x = cos;
      node.y = sin;

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
  this.items = [];

  options = options || {};
  this.showTrace = options.showTrace || false;
  this.linkModel = options.linkModel || 'circle';
  this.linkAccuracy = options.linkAccuracy || 10.0;
  this.linkOverlapRatio = options.linkOverlapRatio || this.linkModel === 'circle'?1.5:1.0;
  this.nodeModel = options.nodeModel || 'circle';
  this.nodeAccuracy = options.nodeAccuracy || this.nodeModel === 'circle'?20:25;
};

EventLayer.prototype.connect = function () {
  this.plane.links.forEach (function (link) {
    var length = link.length ();
    var acc = 2*this.linkAccuracy;
    var overlapRatio = this.linkOverlapRatio;
    for (var i = 1;i < Math.ceil (overlapRatio*length/acc);i++) {
      var x = link.head.x + (link.tail.x - link.head.x)*(i*acc/(length*overlapRatio));
      var y = link.head.y + (link.tail.y - link.head.y)*(i*acc/(length*overlapRatio));
      this.items.push ({ item: link, x: x, y: y });
      if (this.showTrace) {
        this.drawTrace.apply (this, ['link', x, y]);
      };
    }
  }, this);
  this.plane.nodes.forEach (function (node) {
    this.items.push ({ item: node, x: node.x, y: node.y });
    if (this.showTrace) {
      this.drawTrace.apply (this, ['node', node.x, node.y]);
    };
  }, this);
  if (this.showTrace) {
    this.plane.ctx.strokeStyle='#000';
  }

  return this;
};

EventLayer.prototype.drawTrace = function (type, x, y) {
  this.plane.ctx.strokeStyle='#F00';
  var acc, model;
  if (type === 'link') {
    acc = this.linkAccuracy;
    model = this.linkModel;
  } else if (type === 'node') {
    acc = this.nodeAccuracy;
    model = this.nodeModel;
  }
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

  return this.items.reduce (function (memo, item) {
    var acc = self.nodeAccuracy;
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
};

var Link = function (plane, na, nb) {
  this.id = na.id+':'+nb.id;
  this.plane = plane;
  this.head = na;
  this.tail = nb;
  this.cost = 0;
  this.title = '';

  this.style = {
    fillStyle: null,
    strokeStyle: '#000',
    lineWidth: 1
  };
  this.highlightStyle = {
    fillStyle: null,
    strokeStyle: '#000',
    lineWidth: 2
  };

  return this;
};

Link.prototype.draw = function (highlight) {
  this.plane.ctx.beginPath ();
  var cos_head = (this.tail.x - this.head.x)/this.length ();
  var sin_head = (this.tail.y - this.head.y)/this.length ();
  var cos_tail = (this.tail.x - this.head.x)/this.length ();
  var sin_tail = (this.tail.y - this.head.y)/this.length ();
  var radius = this.plane.nodeRadius;
  this.plane.ctx.moveTo (this.head.x + cos_head*radius, this.head.y + sin_tail*radius);
  if (highlight) {
    this.plane.ctx.lineWidth=this.highlightStyle.lineWidth;
  }
  this.plane.ctx.lineTo (this.tail.x - cos_tail*radius, this.tail.y - sin_tail*radius);
  this.plane.ctx.stroke ();

  if (this.plane.showLinkTitle) {
    this.plane.ctx.fillStyle="#000";
    this.plane.ctx.font="20px sans";
    this.plane.ctx.fillText (this.title || this.id, this.head.x + (this.tail.x - this.head.x)/2, this.head.y + (this.tail.y - this.head.y)/2);
  }

  this.plane.ctx.closePath ();
  this.plane.ctx.lineWidth=this.style.lineWidth;

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

  this.style = {
    fillStyle: null,
    strokeStyle: '#000',
    lineWidth: 1
  };
  this.highlightStyle = {
    fillStyle: null,
    strokeStyle: '#000',
    lineWidth: 2
  };

  return this;
};

Node.prototype.draw = function (highlight) {
  this.plane.ctx.beginPath ();
  this.plane.ctx.strokeStyle=this.style.strokeColor;
  if (highlight) {
    this.plane.ctx.strokeStyle=this.highlightStyle.strokeStyle;
    this.plane.ctx.fillStyle=this.highlightStyle.fillStyle;
    this.plane.ctx.lineWidth=this.highlightStyle.lineWidth;
  }
  this.plane.ctx.arc (this.x,this.y,this.plane.nodeRadius,0,2*Math.PI);
  this.plane.ctx.stroke ();

  this.plane.ctx.fillStyle=this.style.filleStyle;
  this.plane.ctx.strokeStyle=this.style.strokeStyle;
  this.plane.ctx.font=(2*this.plane.nodeRadius)+"px sans";
  this.plane.ctx.fillText (this.title || this.id,this.x - this.plane.nodeRadius/2,this.y + this.plane.nodeRadius/2);

  this.plane.ctx.closePath ();
  this.plane.ctx.lineWidth=this.style.lineWidth;

  return this;
};
