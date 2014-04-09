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
 if (rule === 'random-circle') {
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
  } else if (rule === 'random-square') {
    var nb = this.nodes.length;
    var cols = Math.ceil (Math.sqrt (nb));
    var rows = Math.ceil (nb/cols);
    var width = this.width - 2*this.nodeRadius;
    var height = this.height - 2*this.nodeRadius;

    this.nodes.forEach (function (node, index) {
      var xmin = (index%cols)*width/cols;
      var ymin = (Math.floor (index/cols))*height/rows;

      var xmax = xmin + width/cols;
      var ymax = ymin + height/rows;

      node.x = Math.random ()*(xmax - xmin) + xmin + this.nodeRadius;
      node.y = Math.random ()*(ymax - ymin) + ymin + this.nodeRadius;
    }, this);
  } else if (rule === 'harmony') {
    var nb = this.nodes.length;
    var radius = Math.sqrt (this.width*this.height/(Math.PI*nb));
    var nodes = [];
    this.nodes.forEach (function (node, index) {
      var val, x, y;
      do {
        x = Math.random ()*(this.width - 2*this.nodeRadius) + this.nodeRadius;
        y = Math.random ()*(this.height - 2*this.nodeRadius) + this.nodeRadius;
        val = nodes.every (function (elem) {
          return Math.sqrt ((x - elem.x)*(x - elem.x) + (y - elem.y)*(y - elem.y)) > radius;
        });
      } while (val === false);
      nodes.push ({
        x: x,
        y: y
      });
      node.x = x;
      node.y = y;
    }, this);
  } else {
    this.nodes.forEach (function (node) {
      node.x = Math.random ()*(this.width - 2*this.nodeRadius) + this.nodeRadius;
      node.y = Math.random ()*(this.height - 2*this.nodeRadius) + this.nodeRadius;
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
  this.item_on = null;

  options = options || {};
  this.showTrace = options.showTrace || false;
  this.linkModel = options.linkModel || 'circle';
  this.linkAccuracy = options.linkAccuracy || 10.0;
  this.linkOverlapRatio = options.linkOverlapRatio || 1.0;
  this.nodeModel = options.nodeModel || 'circle';
  this.nodeAccuracy = options.nodeAccuracy || this.nodeModel === 'circle'?20:25;

  var self = this;
  this.plane.on ('mousemove', function (e) {
    var position = plane.getMousePosition (e);
    var item = el.getItemByPosition (position.x, position.y);
    if (item) {
      var evt = new CustomEvent ('el_mouseover', {detail: item});
      document.dispatchEvent (evt);
      if (!self.item_on || (self.item_on && self.item_on.item.id !== item.item.id)) {
        var evt = new CustomEvent ('el_mousein', {detail: item});
        document.dispatchEvent (evt);
      }
      self.item_on = item;
    } else {
      if (self.item_on) {
        var evt = new CustomEvent ('el_mouseout', {detail: self.item_on});
        document.dispatchEvent (evt);
      }
      self.item_on = null;
    }
  });
};

EventLayer.prototype.connect = function () {
  this.plane.links.forEach (function (link) {
    var length = link.length ();
    var acc = this.linkAccuracy;
    var overlapRatio = this.linkOverlapRatio;
    for (var i = 1;i < Math.ceil (overlapRatio*length/acc);i++) {
      var x = link.head.x + (link.tail.x - link.head.x)*(i*acc/(length*overlapRatio));
      var y = link.head.y + (link.tail.y - link.head.y)*(i*acc/(length*overlapRatio));
      var coverage = Math.sqrt ((link.head.x - x)*(link.head.x - x) + (link.head.y - y)*(link.head.y - y))/length;
      this.items.push ({ item: link, x: x, y: y, accuracy: acc, coverage: coverage });
      if (this.showTrace) {
        this.drawTrace.apply (this, ['link', x, y, acc, coverage]);
      };
    }
  }, this);
  this.plane.nodes.forEach (function (node) {
    var acc = this.nodeAccuracy;
    this.items.push ({ item: node, x: node.x, y: node.y, accuracy: acc });
    if (this.showTrace) {
      this.drawTrace.apply (this, ['node', node.x, node.y, acc]);
    };
  }, this);
  if (this.showTrace) {
    this.plane.ctx.strokeStyle='#000';
  }

  return this;
};

EventLayer.prototype.drawTrace = function (type, x, y, accuracy, coverage) {
  this.plane.ctx.strokeStyle='#F00';
  var ratio = 1.0;
  if (coverage) {
    coverage = (coverage > 0.5)?(1-coverage):coverage;
    ratio = 0.5+Math.log (2*coverage+1);
  }
  var model;
  var acc = accuracy*ratio;
  if (type === 'link') {
    model = this.linkModel;
  } else if (type === 'node') {
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
  var accuracy = this.nodeAccuracy;

  return this.items.reduce (function (memo, item) {
    var ratio = 1.0;
    if (item.coverage) {
      var coverage = item.coverage;
      coverage = (coverage > 0.5)?(1-coverage):coverage;
      ratio = 0.5+Math.log (2*coverage+1);
    }
    var acc = accuracy*ratio;
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

EventLayer.prototype.on = function (_event, cb) {
  document.addEventListener ('el_'+_event, function (e) {
    cb (e, e.detail);
  });
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
