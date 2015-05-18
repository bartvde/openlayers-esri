// see http://resources.arcgis.com/en/help/rest/apiref/index.html?symbol.html

if (!window.olarcgis) {
  window.olarcgis = {};
}
var olarcgis = window.olarcgis;

olarcgis.styleConverter = function(options) {
  for (var prop in options)   {
    if (this.hasOwnProperty(prop)) {
      this[prop] = options[prop];
    }
  }
  this.converters = {};
  this.converters['esriPMS'] = this.convertEsriPMS;
  this.converters['esriSFS'] = this.convertEsriSFS;
  this.converters['esriSMS'] = this.convertEsriSMS;
  this.renderers = {};
  this.renderers['uniqueValue'] = this.renderUniqueValue;
  this.renderers['simple'] = this.renderSimple;
  this.renderers['classBreaks'] = this.renderClassBreaks;
};

olarcgis.styleConverter.prototype.convertPointToPixel = function(point) {
  return Math.ceil(point/0.75);
};

// convert an Esri Picture Marker Symbol
olarcgis.styleConverter.prototype.convertEsriPMS = function(symbol) {
  var width = olarcgis.styleConverter.prototype.convertPointToPixel(symbol.width);
  var height = olarcgis.styleConverter.prototype.convertPointToPixel(symbol.height);
  var img = document.createElement('img');
  img.src = 'data:' + symbol.contentType + ';base64, ' + symbol.imageData;
  return new ol.style.Style({
    image: new ol.style.Icon({
      img: img,
      imgSize: [img.width, img.height],
      scale: width/img.width
    })
  });
};

olarcgis.styleConverter.prototype.transformColor = function(color) {
  // alpha channel is different, runs from 0-255 but in ol3 from 0-1
  return [color[0], color[1], color[2], color[3]/255];
};

// convert an Esri Simple Fill Symbol
olarcgis.styleConverter.prototype.convertEsriSFS = function(symbol) {
  var fill = new ol.style.Fill({color: this.transformColor(symbol.color)});
  var stroke = new ol.style.Stroke({color: this.transformColor(symbol.outline.color)});
  return new ol.style.Style({
    fill: fill,
    stroke: stroke
  });
};

// convert an Esri Simple Marker Symbol
olarcgis.styleConverter.prototype.convertEsriSMS = function(symbol, opt_size) {
  if (symbol.style === 'esriSMSCircle') {
    // TODO implement outline style (e.g. "esriSLSSolid")
    var circle = new ol.style.Circle({
      radius: opt_size ? opt_size : symbol.size,
      fill: new ol.style.Fill({color: this.transformColor(symbol.color)}),
      stroke: new ol.style.Stroke({color: this.transformColor(symbol.outline.color), width: symbol.outline.width}) 
    });
    return new ol.style.Style({
      image: circle
    });
  }
};

olarcgis.styleConverter.prototype.renderSimple = function(renderer) {
  return this.converters[renderer.symbol.type].call(this, renderer.symbol);
};

olarcgis.styleConverter.prototype.renderClassBreaks = function(renderer) {
  var field = renderer.field;
  var minDataValue = renderer.visualVariables[0].minDataValue;
  var maxDataValue = renderer.visualVariables[0].maxDataValue;
  var minSize = renderer.visualVariables[0].minSize;
  var maxSize = renderer.visualVariables[0].maxSize;
  var sizes = [];
  var size = minSize;
  var symbol = renderer.classBreakInfos[0].symbol;
  while (size <= maxSize) {
    sizes.push(olarcgis.styleConverter.prototype.convertPointToPixel(size));
    size += minSize;
  }
  var classes = [];
  var min = minDataValue;
  var geomFunction = function(feature) { 
    var geometry = feature.getGeometry();
    if (geometry && geometry instanceof ol.geom.Polygon) { 
      return geometry.getInteriorPoint();
    } 
  };
  var increment = (maxDataValue-minDataValue)/sizes.length;
  for (var i = 0, ii = sizes.length; i < ii; ++i) {
    var style = this.converters[symbol.type].call(this, symbol, sizes[i]);
    style.setGeometry(geomFunction);
    classes.push({min: min, max: min + increment, style: style});
    min += increment;
  }
  return (function() {
    return function(feature, resolution) {
      var value = feature.get(field);
      for (var i=0, ii=classes.length; i<ii; ++i) {
        if (value >= classes[i].min && value <= classes[i].max) {
          return [classes[i].style];
        }
      }
    };
  }());
};

olarcgis.styleConverter.prototype.renderUniqueValue = function(renderer) {
  var field = renderer.field1;
  var infos = renderer.uniqueValueInfos;
  var me = this;
  return (function() {
    var hash = {};
    for (var i = 0, ii = infos.length; i < ii; ++i) {
      var info = infos[i], symbol = info.symbol;
      hash[info.value] = [me.converters[symbol.type].call(me, symbol)];
    }
    return function(feature, resolution) {
      return hash[feature.get(field)];
    };
  }());
};

olarcgis.styleConverter.prototype.read = function(drawingInfo) {
  return this.renderers[drawingInfo.renderer.type].call(this, drawingInfo.renderer);
};
