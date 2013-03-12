  
function cmd_chart(selection, metaData ) {

  var chartDescription = selection.select(".chartDescription");
 
  selection.select(".chartContainer").each(function() { 

    var series = new Object();

    var speed = 500;
    var margin = 40;
    
    var currentLevel = 0;
    var currentLevel = metaData.levels[0]; 
  
    var totalWidth  = $(this).width() ; 
    var totalHeight = $(this).height() ;

    var width  = totalWidth - 2*margin; 
    var height = totalHeight - 2*margin;

    var timeFrom = metaData.dateFormat.parse(metaData.dateFrom).getTime();
    var timeTo   = metaData.dateFormat.parse(metaData.dateTo).getTime();
    var timeMin = metaData.dateFormat.parse(metaData.dateMin).getTime();
    var timeMax = metaData.dateFormat.parse(metaData.dateMax).getTime();
    
    var scalesTime = d3.time.scale()
      .range([0,width])
      .domain([timeFrom,timeTo]);
    var scalesValue = d3.scale.linear()
      .range([height,0])
      .domain([metaData.valueMin,metaData.valueMax]);
 
    var xAxis = d3.svg.axis()
      .scale(scalesTime)
      .orient("bottom")
      .tickPadding(6)
      .tickSize(height);

    var yAxis = d3.svg.axis()
      .scale(scalesValue)
      .orient("left")
      .tickPadding(3)
      .tickSize(width);
  
    ////////////////

    function loadDataAndRedraw(instant, levelUpFromSerie, levelDownToSerie) { 
      
      function queryAndDraw(query) {
        
        var url = query.url(dateFrom, dateTo, currentLevel.grouping);
       
        console.log ("AJAX Query: "+url);
        d3.json(url, function(data) {
            
          var table = data[query.tableName];
          var newSeries = new Object();
          for (var i=0; i<table.length; i++) {
            var key = table[i][query.serieKey];
            if (!series[key]) {
              series[key] = new Array();
              series[key].level = currentLevel;
              console.log ("Serie added:"+key);
  
            }
              
            var date = metaData.dateFormat.parse( table[i][query.dateKey] ).getTime();
            var value = table[i][query.valueKey];
            
            var foundExisting = false;
            for (d in series[key]) 
              if (series[key][d].date == date) {
                series[key][d].value = value;
                foundExisting = true;
                break;
              }
            if (!foundExisting)
              series[key].push( { "date" : date, "value": value } );
          }
          
          function getNearestData(serie, currentDate) {
            var minDist = 1000 * 60 * 60 * 24 * 365;
            var re = null;
            for (i = 0; i < serie.length; i++ ) {
              var dist = Math.abs(serie[i].date - currentDate);
              if (dist < minDist) {
                re = serie[i];
                minDist = dist;
              }
            }
            return re;
          }
           
          function bindEvents(ss) {
              series[ss].path.on("mousemove", function() {
                  
                  var coords = d3.mouse(svg.node());
                  var currentDate = scalesTime.invert(coords[0]-margin);
                  
                  var nearest = getNearestData(series[ss], currentDate);
                  if (nearest) {
                    var dateFormatted = metaData.dateFormat(new Date(nearest.date));  
                    var px = scalesTime(nearest.date);
                    var py = scalesValue(nearest.value);
                    
                    svgInfoText.text(ss+" ("+dateFormatted+": "+nearest.value+")");
                    svgInfoMark
                      .style("display","block" )
                      .attr("cx", px + margin )
                      .attr("cy", py + margin )
                      .style("stroke", series[ss].color)
                      .style("fill", series[ss].color);
                  }
                    
 
                  if (query.onClick != 0)
                    d3.select(this).classed("mouseover", true);
              }).on("mouseout", function() {
                  svgInfoText.text("");
                  svgInfoMark.style("display","none" );
                  if (query.onClick != 0)
                    d3.select(this).classed("mouseover", false);
              });
              
              if (query.onClick != 0)
                series[ss].path.on("click", function() {
              
                  if (query.onClick < 0)
                    loadDataAndRedraw(false,null,currentLevel.grouping);
                  else if (query.onClick > 0){
                    series[ss].path.classed("clicked", true);
                    console.log ("Clicked serie: "+ss);
                    loadDataAndRedraw(false,ss);
                  }
                             
              });
          } 
           
          for ( s in series ) {
            series[s].sort(function(a,b) { return a.date - b.date; } );
            if (!series[s].path) {

              series[s].color = (typeof(query.color) == "function") ? query.color(s) : query.color;
              series[s].styleName = (typeof(query.styleName) == "function") ? query.styleName(s) : query.styleName;

              series[s].path = clippedArea.append("svg:path")
                                  .attr("d", line(series[levelUpFromSerie ? levelUpFromSerie : s]))
                                  .classed( series[s].styleName, true )
                                  .style("stroke", d3.rgb(255,255,255).toString());
                    
              bindEvents (s);
              
            }
          }   
                   
          if (numOfQueriesToPerform > 1)
            numOfQueriesToPerform--;
          else {
            redraw(instant);
            
            if (zoomTimer)
              clearTimeout(zoomTimer);
            zoomTimer = null;
          }
  
        });
      }
      
      ///////////////////
      
      zoomTimer = false;
      
      if (levelUpFromSerie) {
        currentLevel ++;
        currentLevel = metaData.levels[currentLevel]; 
        currentLevel.grouping = levelUpFromSerie;
      }
      else if (levelDownToSerie) {
        currentLevel --;
        currentLevel = metaData.levels[currentLevel]; 
      }  
         
      var timeDomain = scalesTime.domain();
      var dateFrom = metaData.dateFormat(new Date(timeDomain[0]));
      var dateTo =   metaData.dateFormat(new Date(timeDomain[1]));
      
      var numOfQueriesToPerform = currentLevel.queries.length;
      for (q=0; q<currentLevel.queries.length; q++) {
        queryAndDraw(currentLevel.queries[q], dateFrom, dateTo );
      }
    }
    
    function redraw(instant) {
    
      var timeDomain = scalesTime.domain();
      if (timeDomain[0] < timeMin)
          timeDomain[0] = timeMin;
      if (timeDomain[1] > timeMax)
          timeDomain[1] = timeMax;
      
      console.log(d3.event.scale);
      console.log(d3.event.translate);

      if (instant) 
      {
        for ( s in series ) 
          series[s].path.attr("d", line(series[s]));
      }
      else {
        for ( s in series ) {
          if (series[s].level == currentLevel)
            series[s].path.classed("clicked", false).transition()
              .duration(speed)
              .attr("d", line(series[s]))
              .style("stroke", series[s].color );
          else if (series[s].level < currentLevel)
            series[s].path.transition()
              .duration(speed)
              .attr("d", line(series[s]))
              .style("stroke", d3.rgb(240,240,240).toString());   
          else if (series[s].level > currentLevel) {
            series[s].path.transition()
              .duration(speed)
              .attr("d", line(series[metaData.levels[currentLevel+1].grouping]))
              .remove();
              
            delete series[s];
          }
        }
      }
        
      for (si = 0; si < metaData.shadedIntervals.length; si++) {
        var timeFrom = metaData.dateFormat.parse(metaData.shadedIntervals[si].dateFrom).getTime();
        var timeTo =   metaData.dateFormat.parse(metaData.shadedIntervals[si].dateTo).getTime();
        svgShadedIntervals[si]
        .attr("x",  (scalesTime(timeFrom) + margin) + "px")
        .attr("width", (scalesTime(timeTo) - scalesTime(timeFrom)) + "px");
      }
        
      if (instant) {
        svgXaxis.call(xAxis);
        svgYaxis.call(yAxis);
      }
      else {      
        svgXaxis.transition().duration(speed).call(xAxis);
        svgYaxis.transition().duration(speed).call(yAxis);
        
        svgTitle.text(currentLevel.title);
        chartDescription.text(currentLevel.description);
      }
    }
    
    ///////////////////////////////
    //
    // TIMER FOR ZOOMING
    //
    ///////////////////////////////
    
    var zoomTimer = null;
    var zoomTimeout = 300;
    
    function onZoomTimer() {
      console.log("onZoomTimer");
      zoomTimer = null;
      loadDataAndRedraw(true);
    }
    function zoomStart() {
      if (zoomTimer === false)
        return;
    
      if (zoomTimer)
        clearTimeout(zoomTimer);
      zoomTimer = setTimeout(function(){ onZoomTimer(); },zoomTimeout);
    } 
        
    //////////////////////////
    
    /*function initHairCross (parent) {
      var verticalLine = null;
      var horizontalLine = null;
       
      var w = width;
      var h = height;
      var x = margin;
      var y = margin;

      parent.on("mouseover", function() {      
        var coords = d3.mouse(this);
        horizontalLine = svg.append("line")
          .attr("x1", x+0)
          .attr("y1", y+coords[1])
          .attr("x2", x+w)
          .attr("y2", y+coords[1])
          .classed("hairCross", true);
        verticalLine = svg.append("line")
          .attr("x1", x+coords[0])
          .attr("y1", y+0)
          .attr("x2", x+coords[0])
          .attr("y2", y+h)
          .classed("hairCross", true);             
      });
      parent.on("mouseout", function() {
        svg.remove(horizontalLine);
        svg.remove(verticalLine);
        horizontalLine = null;
        verticalLine = null;
      });
      parent.on("mousemove", function() {
        if (verticalLine && horizontalLine) {
          var coords = d3.mouse(this);
          horizontalLine 
          .attr("x1", x+0)
          .attr("y1", y+coords[1])
          .attr("x2", x+w)
          .attr("y2", y+coords[1]);
          verticalLine 
          .attr("x1", x+coords[0])
          .attr("y1", y+0)
          .attr("x2", x+coords[0])
          .attr("y2", y+h);    
        }
      });
    }  */
            
    ///////////////////////////////
    //
    // INIT
    //
    ///////////////////////////////
  
 
    //svg init
    var svg = d3.select(this).append("svg:svg")
      .attr("width", totalWidth)
      .attr("height",totalHeight);
    
    var line = d3.svg.line()
      .x(function(dataRecord) { return margin + scalesTime(dataRecord["date"]); })
      .y(function(dataRecord) { return margin + scalesValue(dataRecord["value"]);});  

       
    ////////////////
    
    svg.append("rect")
      .attr("class", "chartBackground")
      .attr("width", width + "px")
      .attr("height", height + "px")
      .attr("x", margin + "px")
      .attr("y", margin + "px");
      //.call (initHairCross);
        
    var svgInfoText = svg.append("text")
        .classed("infoText",true)
        .attr("transform", "translate(" + (width + margin) + ",35)")
        .style("text-anchor", "end");
 
      
    var svgTitle = svg.append("text")
      .attr("transform", "translate(" + (margin) + ",25)")
      .classed("chartTitle", true)
      .text("");
      
    svg.call(d3.behavior.zoom()
      .x(scalesTime)
     // .y(scalesValue)
      .scaleExtent([0.25, 4])
      .on("zoom", function() { 
        redraw(true);
        zoomStart();
      }));
      
    var svgXaxis = svg.append("g")
      .attr("class", "xaxis axis")
      .attr("transform", "translate("+margin+"," + margin + ")");

    var svgYaxis = svg.append("g")
      .attr("class", "yaxis axis")
      .attr("transform", "translate("+(width + margin)+","+ margin +")");
  
    var clipRect = svg.append("svg:clipPath")
        .attr("id", "clipRect")
        .append("svg:rect")
        .attr("width", width + "px")
        .attr("height", height + "px")
        .attr("x", margin + "px")
        .attr("y", margin + "px");
        
    var clippedArea = svg.append("g")
        .attr("clip-path", "url(#clipRect)");
        
           
    var svgShadedIntervals = new Array();
    for (si = 0; si < metaData.shadedIntervals.length; si++) {
       svgShadedIntervals[si] = clippedArea.append("rect")
        .classed("shadedIntervals",true)
        .style("fill", metaData.shadedIntervals[si].color)
        .attr("y", margin + "px")
        .attr("height", height + "px");
    }

    var svgInfoMark = clippedArea.append("circle")
        .classed("infoMark",true)
        .attr("r", 4)
        .style("display","none" );
               
    ///////////////////////////
   
    xAxis.scale(scalesTime)
      .ticks(metaData.timeAxis.tickCount)
      .tickFormat(metaData.timeAxis.tickFormat)
      .tickSubdivide(metaData.timeAxis.subdivide);
    yAxis.scale(scalesValue) 
      .ticks(metaData.valueAxis.tickCount)
      .tickFormat(metaData.valueAxis.tickFormat)
      .tickSubdivide(metaData.valueAxis.subdivide);

    ///////////////////////////

    loadDataAndRedraw(false);

  });
    
  return this; //for method chaining
}
  
  
  

